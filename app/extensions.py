from concurrent.futures import ThreadPoolExecutor
from functools import wraps
from typing import TYPE_CHECKING, Any, Callable, TypeVar, TypedDict
from typing_extensions import NotRequired

import flask_cors
from flask import request
from flask_mailman import Mail
from flask_migrate import Migrate
from flask_security.core import Security
from flask_security.datastore import SQLAlchemyUserDatastore
from flask_session import Session
from flask_socketio import SocketIO, join_room # pyright: ignore[reportUnknownVariableType]
from flask_sqlalchemy import SQLAlchemy

if TYPE_CHECKING:
    from .classes import App


_T = TypeVar('_T', bound=Any)


def init_db(app: 'App'):
    class TypedSQLA(SQLAlchemy):
        def query(self, cls: type[_T]):
            return self.session.query(cls)    # ensures proper typing

    db = TypedSQLA()
    db.init_app(app)
    return db


def init_migrate(app: 'App', db: SQLAlchemy):
    migrate = Migrate()
    migrate.init_app(app, db, render_as_batch=True)  # type: ignore
    return migrate


def init_cors(app: 'App'):
    return flask_cors.CORS(app)


class MQConf(TypedDict):
    message_queue_url: NotRequired[str]

_UNIQ = object()

def init_socketio(app: 'App'):
    class SocketOps:
        class CallError(Exception):
            def __init__(self, msg: str):
                self.msg = msg

            def __str__(self):
                return f'Call error: {self.msg}'

        def __init__(self, io: SocketIO):
            self.client_id = ''

            def get_client_id():
                client_id: str | None = request.args.get('clientId')
                if client_id:
                    app.logger.info('WS client connected: %s', client_id)
                    self.client_id = client_id
                    join_room(client_id)

            io.on('connect')(get_client_id)
            self.io = io
            self.tp = ThreadPoolExecutor(max_workers=2)

        def run(self, app: 'App', host: str | None = None, port: int | None = None, **kwargs: Any):
            self.io.run(app, host, port, **kwargs)  # pyright:ignore[reportUnknownMemberType]

        def emit(self, msg: str, *args: Any, **kwargs: Any) -> None:
            return self.io.emit(msg, *args, **kwargs) # pyright:ignore[reportUnknownMemberType]

        def on(self, message: str, namespace: str | None = None):
            return self.io.on(message, namespace)

        def start_background_task(self, target: Callable[..., Any], *args: Any, **kwargs: Any):
            return self.io.start_background_task(target, *args, **kwargs)

        def onmsg(self, message: str, namespace: str | None = None):
            from .helpers import RequestError

            decorator = self.on(message, namespace)
            return_msg = f'{message}_response'
            def my_decorator(func: Callable[..., Any]):
                @wraps(func)
                def wrapped(kw_args: dict[str, Any]):
                    app.logger.debug('WS call [%s]: %r', message, kw_args)
                    req_id = kw_args.pop('reqId', None)
                    data = kw_args.pop('data', _UNIQ)
                    if data is None:
                        args, kwargs = (), {}
                    elif data is _UNIQ:
                        args, kwargs = (), kw_args
                    elif isinstance(data, (list, tuple)):
                        items: tuple[Any, ...] | list[Any] = data  # pyright: ignore[reportUnknownVariableType]
                        args, kwargs = items, {}
                    else:
                        args, kwargs = (), data
                    try:
                        resp = func(*args, **kwargs)
                    except RequestError as err:
                        app.logger.warning('WS call [%s] (%r): finished with error: %s', message, kw_args, str(err))
                        self.emit(return_msg, { 'reqId': req_id, 'status': 'error', 'error': err.to_dict() })
                    except Exception as exc:
                        app.logger.warning('WS call [%s] (%r): finished with error: %s', message, kw_args, str(exc))
                        self.emit(return_msg, { 'reqId': req_id, 'status': 'error', 'error': { 'code': 900, 'msg': str(exc) } })
                    else:
                        if callable(resp):
                            sid = self.client_id or getattr(request, 'sid', None)
                            if not sid:
                                app.logger.warning('WS long task: Unable to determine websocket client session')
                                self.emit(return_msg,
                                          { 'reqId': req_id, 'status': 'error', 'error': 'Unable to determine websocket client session' })
                                return None

                            def task():
                                with app.app_context():
                                    app.logger.info('WS long task [%s] [%s]: start', message, sid)
                                    try:
                                        result = resp(sid)
                                    except RequestError as err:
                                        app.logger.warning('WS long task [%s] [%s]: finished with error: %s', message, sid, str(err))
                                        self.emit(return_msg, { 'reqId': req_id, 'status': 'error', 'error': err.to_dict() }, room=sid)
                                    except Exception as exc:
                                        app.logger.warning('WS long task [%s] [%s]: finished with error: %s', message, sid, str(exc))
                                        self.emit(return_msg,
                                                  { 'reqId': req_id, 'status': 'error', 'error': { 'code': 901, 'msg' : str(exc) } }, room=sid)
                                    else:
                                        app.logger.info('WS long task [%s] [%s]: succeeded', message, sid)
                                        app.logger.debug('WS long task [%s] [%s] return: %r', message, sid, result)
                                        self.emit(return_msg, { 'reqId': req_id, 'status': 'success', 'data': result }, room=sid)
                            self.tp.submit(task)
                            return None
                        app.logger.debug('WS call [%s] return: %r', message, resp)
                        self.emit(return_msg, { 'reqId': req_id, 'status': 'success', 'data': resp })
                return decorator(wrapped)
            return my_decorator

    origins = app.get_config('ORIGINS', str, '').split()
    urls = [
        f'http://{host}{slash}' if host.partition(':')[0] not in ('http', 'https') else host + slash for host in (
            '127.0.0.1:3000', '127.0.0.1:8000', '127.0.0.1:5000',
            'localhost:3000', 'localhost:8000', 'localhost:5000',
            *origins
        ) for slash in ('/', '')
    ] if '*' not in origins else '*'
    message_queue = app.get_config('FLASK_SOCKETIO', dict, MQConf()).get('message_queue_url', 'redis://')
    return SocketOps(SocketIO(app, cors_allowed_origins=urls, manage_session=False, async_handlers=True,
                              async_mode='gevent', message_queue=message_queue, path=(app.PREFIX.rstrip('/') + '/socket.io').lstrip('/')))


def init_security():
    return Security()


def init_security_stage2(app: 'App'):
    from .base.models import User, Role

    app.config.update({
        'SECURITY_CONFIRMABLE': True,
        'SECURITY_CONFIRM_URL': '/api/confirm',
        'SECURITY_POST_CONFIRM_VIEW': f'{app.PREFIX}/main#confirmed',
        #'SECURITY_CONFIRM_EMAIL_WITHIN': '5 days',
        'SECURITY_SEND_CONFIRMATION_TEMPLATE': 'security/send_confirmation.html',
        'SECURITY_EMAIL_SUBJECT_CONFIRM': f'{app.APPNAME}: Please confirm your email',
        'SECURITY_CHANGEABLE': True,
        'SECURITY_CHANGE_URL': '/api/change_password',
        'SECURITY_CHANGE_PASSWORD_TEMPLATE': 'security/change_password.html',
        'SECURITY_EMAIL_SUBJECT_PASSWORD_CHANGE_NOTICE': f'{app.APPNAME}: Your password has been changed',
        'SECURITY_RECOVERABLE': True,
        'SECURITY_RESET_URL': '/reset',
        'SECURITY_POST_RESET_VIEW': f'{app.PREFIX}/main#reset',
        'SECURITY_RESET_PASSWORD_TEMPLATE': 'security/reset_password.html',
        'SECURITY_FORGOT_PASSWORD_TEMPLATE': 'security/forgot_password.html',
        #'SECURITY_RESET_PASSWORD_WITHIN': '1 days',
        'SECURITY_EMAIL_SUBJECT_PASSWORD_RESET': f'{app.APPNAME}: Password reset instructions',
        'SECURITY_EMAIL_SUBJECT_PASSWORD_NOTICE': f'{app.APPNAME}: Your password has been reset',
        'SECURITY_CHANGE_EMAIL': True,
        'SECURITY_CHANGE_EMAIL_SUBJECT': f'{app.APPNAME}: Confirm your new email address',
        'SECURITY_CHANGE_EMAIL_TEMPLATE': 'security/change_email.html',
        #'SECURITY_CHANGE_EMAIL_WITHIN': '2 hours',
        'SECURITY_CHANGE_EMAIL_URL': '/api/change-email',
        'SECURITY_CHANGE_EMAIL_CONFIRM_URL': '/api/change-email-confirm',
        'SECURITY_REGISTERABLE': True,
        'SECURITY_REGISTER_URL': '/api/register',
        'SECURITY_REGISTER_USER_TEMPLATE': 'security/register_user.html',
        'SECURITY_USERNAME_ENABLE': True
    })
    user_datastore = SQLAlchemyUserDatastore(app.db, User, Role)   # type: ignore
    app.security.init_app(app, user_datastore)


def init_session(app: 'App'):
    Session(app)


def init_mail(app: 'App'):
    return Mail(app)
