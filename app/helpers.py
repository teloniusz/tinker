import datetime
from functools import wraps
from typing import Any, Callable, Generic, TypeVar

from flask import jsonify, make_response
from sqlalchemy.orm import Query
import requests

from . import app


_T = TypeVar('_T')


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
    return {'field_errors': errdata}


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