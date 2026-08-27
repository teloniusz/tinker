import datetime
from functools import wraps
from typing import Any, Callable, Generic, NotRequired, TypeVar, TypedDict

from flask import jsonify, make_response
from sqlalchemy.orm import Query
import requests

from . import app


_T = TypeVar('_T')


class FieldData(TypedDict):
    field_errors: dict[str, list[str]]
    errors: list[list[str]]


class ErrorType(TypedDict):
    code: int
    msg: str
    field_data: NotRequired[FieldData]


class RequestError(Exception):
    def __init__(self, error: str | dict[str, list[str] | str], code: int = 400):
        if isinstance(error, str):
            self.errors = error
            self.field_errors = None
        else:
            self.field_errors = {key: val if isinstance(val, list) else [val] for key, val in error.items()}
            self.errors = [*self.field_errors.values()]
        self.code = code

    def to_dict(self) -> ErrorType:
        if isinstance(self.errors, str):
            return {'code': self.code, 'msg': self.errors}
        return {'code': self.code, 'msg': '\n'.join(['\n'.join(errors) for errors in self.errors]), 'field_data': {
            'field_errors': self.field_errors or {},
            'errors': self.errors
        }}


_UNIQ = object()


def run_short_task(message: str, return_msg: str, kw_args: dict[str, Any], func: Callable[..., Any]):
    app.logger.debug('WS call [%s]: %r', message, kw_args)
    req_id = kw_args.pop('reqId', '')
    data = kw_args.pop('data', _UNIQ)
    if data is None:
        args, kwargs = (), {}
    elif data is _UNIQ:
        args, kwargs = (), kw_args
    elif isinstance(data, (list, tuple)):
        items: tuple[Any, ...] | list[Any] = data  # pyright: ignore[reportUnknownVariableType]
        args, kwargs = items, {}
    elif isinstance(data, dict):
        kwitems: dict[str, Any] = data  # pyright: ignore[reportUnknownVariableType]
        args, kwargs = (), kwitems
    else:
        args, kwargs = (data,), {}
    try:
        resp = func(*args, **kwargs)
    except RequestError as err:
        app.logger.warning('WS call [%s] (%r): finished with error: %s', message, kw_args, str(err), exc_info=True)
        app.sio.emit(return_msg, { 'reqId': req_id, 'status': 'error', 'error': err.to_dict() })
        return None, None
    except Exception as exc:
        app.logger.warning('WS call [%s] (%r): finished with error: %s', message, kw_args, str(exc), exc_info=True)
        app.sio.emit(return_msg, { 'reqId': req_id, 'status': 'error', 'error': { 'code': 900, 'msg': str(exc) } })
        return None, None
    return resp, req_id


def run_long_task(message: str, return_msg: str, req_id: str, sid: str, resp: Callable[[str], Any]):
    with app.app_context():
        app.logger.info('WS long task [%s] [%s]: start', message, sid)
        try:
            result = resp(sid)
        except RequestError as err:
            app.logger.warning('WS long task [%s] [%s]: finished with error: %s', message, sid, str(err))
            app.sio.emit(return_msg, { 'reqId': req_id, 'status': 'error', 'error': err.to_dict() }, room=sid)
        except Exception as exc:
            app.logger.warning('WS long task [%s] [%s]: finished with error: %s', message, sid, str(exc))
            app.sio.emit(return_msg,
                        { 'reqId': req_id, 'status': 'error', 'error': { 'code': 901, 'msg' : str(exc) } }, room=sid)
        else:
            app.logger.info('WS long task [%s] [%s]: succeeded', message, sid)
            app.logger.debug('WS long task [%s] [%s] return: %r', message, sid, result)
            try:
                app.sio.emit(return_msg, { 'reqId': req_id, 'status': 'success', 'data': result }, room=sid)
            except Exception as exc:
                app.logger.error('WS long task [%s] [%s]: emit failed: %s', message, sid, exc, exc_info=True)


def verify_captcha(data: dict[str, Any]):
    token = str(data.get('token') or '')
    error = ''
    if not token:
        error = 'No captcha token supplied'
    else:
        try:
            data = {
                'secret': app.config['RECAPTCHA_SECRET_KEY'],
                'response': token
            }

            response = requests.post(
                'https://www.google.com/recaptcha/api/siteverify',
                data={
                    'secret': app.config['RECAPTCHA_SECRET_KEY'],
                    'response': token
                }
            )
            result = response.json()
            res = bool(result.get('success'))
        except Exception as ex:
            error = f'Error verifying captcha: {ex}'
        else:
            if not res:
                error = 'Captcha not valid'
    return error


def make_resp_data(data: dict[str, Any], code: int = 200) -> dict[str, dict[str, Any]]:
    return {'meta': {'code': code}, 'response': data}


def make_error_data(error: str | dict[str, list[str] | str], code: int = 400) -> dict[str, Any]:
    if isinstance(error, str):
        errdata = {'_': [error]}
    else:
        errdata = {key: val if isinstance(val, list) else [val] for key, val in error.items()}
    return {'field_errors': errdata, 'errors': [*errdata.values()]}


def make_resp(data: dict[str, Any], code: int = 200):
    return make_response(jsonify(make_resp_data(data, code)), code, {'Content-Type': 'application/json'})


def make_error(error: str | dict[str, list[str] | str], code: int = 400):
    return make_resp(make_error_data(error, code), code)


class QHelper(Generic[_T]):
    @classmethod
    def qry(cls) -> Query[_T]:
        return cls.query # type: ignore


def utcnow():
    return datetime.datetime.now(datetime.timezone.utc)


def wrap_errors(fun: Callable[..., Any]) -> Callable[..., Any]:
    @wraps(fun)
    def decorator(*args: Any, **kwargs: Any):
        try:
            ret = fun(*args, **kwargs)
        except Exception as exc:
            return make_error(str(exc))
        return ret
    return decorator