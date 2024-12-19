from datetime import datetime
from typing import Any, Generator, Iterable, cast

import flask_security as fs
from flask_security.views import forgot_password, register, reset_password
from flask_security.forms import ResetPasswordForm, build_form_from_request
from flask_security.utils import base_render_json
from flask_security.recoverable import reset_password_token_status  # type: ignore
from flask_session import base as session_base
from flask import request, session

from .models import Versions, Role, User, current_user
from .. import app
from ..helpers import make_error, make_error_data, make_resp_data, verify_captcha

bp = app.create_blueprint(__name__, url_prefix='/base')


def _format_date(date: datetime | None):
    if date:
        return date.strftime('%F %T')


def _serialize_roles(roles: Iterable[Role]) -> list[dict[str, Any]]:
    return [{'id': role.id, 'name': role.name} for role in roles]


def _get_info(user: User | None) -> Generator[tuple[str, Any], None, None]:
    attrs: dict[str, Any] = {
        'username': None,
        'current_login_at': _format_date,
        'create_datetime': _format_date,
        'update_datetime': _format_date,
        'last_login_ip': None,
        'first_name': None,
        'last_name': None,
        'id': None,
        'current_login_ip': None,
        'active': None,
        'email': None,
        'login_count': None,
        'confirmed_at': _format_date,
        'last_login_at': _format_date,
        'roles': _serialize_roles
    }
    anon_attrs: dict[str, Any] = {
        'username': 'anonymous',
        'first_name': 'Anonymous',
        'last_name': 'User',
        'id': 0
    }
    for elem, process in attrs.items():
        try:
            val = getattr(user, elem)
        except AttributeError:
            yield (elem, anon_attrs.get(elem))
        else:
            yield (elem, val if process is None else process(val))


def _regenerate_session():
    session_interface = cast(session_base.ServerSideSessionInterface, app.session_interface)
    session_interface.regenerate(cast(session_base.ServerSideSession, session))


def _do_login(username: str, password: str):
    user = User.get_user(username)
    if not user:
        app.logger.error('No user found: %r', username)
        return None, 'No user found'
    if username != 'demo':
        try:
            if not fs.utils.verify_password(password, user.password or ''):
                return None, 'Invalid password'
        except Exception:
            return None, 'Invalid password'
    fs.utils.login_user(user)
    return user, 'OK'


@bp.route('/login', methods=['POST'])
def login(data: dict[str, str] | None = None):
    if not data:
        data = request.json
    if data and 'user' in data and 'password' in data:
        ret, msg = _do_login(data['user'], data['password'])
        if not ret:
            app.logger.error('Login failed: %s', msg)
            return ['error', msg]
        app.logger.info('Login succeeded for user: %s', ret)
        _regenerate_session()
        return ['success', 'OK']
    return ['error', 'No data provided']


@bp.route('/logout', methods=['GET'])
def logout():
    cu = current_user()
    if isinstance(cu, User):
        fs.utils.logout_user()
        _regenerate_session()
        app.logger.info('User logged out: %s', cu)
        return ['success', 'User logged out']
    app.logger.info('Logout: user not logged in')
    return ['success', 'No user logged']


@app.sio.onmsg('hello')
def ws_hello(msg: dict[str, Any]):
    version = Versions.last_version()
    if not version:
        ret = {'message': f'Hello, world, {msg["data"]}'}
    else:
        ret = {'message': f'Hello, world, you sent: {msg["data"]!r}',
               'version': version.version, 'modified': version.modified.strftime('%F %T')}
    ret['message'] += f', you are: {current_user()}'
    return ret


@app.sio.onmsg('userinfo')
def ws_userinfo():
    ret = {'user': dict(_get_info(current_user()))}
    app.logger.info('User info: %r', ret['user'])
    return ret


@bp.route('/cregister', methods=['GET', 'POST'])
def captcha_register():
    if request.method == 'GET' or not request.is_json:
        return register()
    error = verify_captcha(request.json or {})
    if error:
        return make_error(error)
    return register()


@bp.route('/csendreset', methods=['GET', 'POST'])
def captcha_send_reset():
    if request.method == 'GET' or not request.is_json:
        return forgot_password()
    error = verify_captcha(request.json or {})
    if error:
        return make_error(error)
    return forgot_password()


@bp.route('/creset/<token>', methods=['GET', 'POST'])
def captcha_reset(token: str):
    if request.method == 'GET' or not request.is_json:
        expired, invalid, user = reset_password_token_status(token)
        if not user or expired or invalid:
            return {'error': f'token {"expired" if expired else "invalid"}'}
        form = cast(ResetPasswordForm, build_form_from_request("reset_password_form"))
        form.user = user
        return base_render_json(form, include_user=False)
    error = verify_captcha(request.json or {})
    if error:
        return make_error(error)
    return reset_password(token)


@app.sio.onmsg('update_profile')
def ws_update_profile(first_name: str, last_name: str, password: str | None, email: str, token: str):
    error = verify_captcha({'token': token})
    if error:
        return make_error_data(error)
    user = current_user()
    if not user:
        return make_error_data('User not logged in')
    user.update_user(first_name, last_name, password, email)
    return make_resp_data({'status': 'ok'})