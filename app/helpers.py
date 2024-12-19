from typing import Any

from flask import jsonify, make_response
import requests

from . import app


def verify_captcha(data: dict[str, Any]):
    token = str(data.get('token') or '')
    error = ''
    if not token:
        error = 'no captcha token supplied'
    else:
        try:
            response = response = requests.post(
                'https://www.google.com/recaptcha/api/siteverify',
                data={
                    'secret': app.config['RECAPTCHA_SECRET_KEY'],
                    'response': token
                }
            )
            result = response.json()
            res = bool(result.get('success'))
        except Exception as ex:
            error = f'error verifying captcha: {ex}'
        else:
            if not res:
                error = 'captcha not valid'
    return error


def make_resp_data(data: dict[str, Any], code: int = 200) -> dict[str, dict[str, Any]]:
    return {'meta': {'code': code}, 'response': data}


def make_error_data(error: str | dict[str, list[str] | str], code: int = 400):
    if isinstance(error, str):
        errdata = {'_': [error]}
    else:
        errdata = {key: val if isinstance(val, list) else [val] for key, val in error.items()}
    return {'field_errors': errdata}

def make_resp(data: dict[str, Any], code: int = 200):
    return make_response(jsonify(make_resp_data(data), code, {'Content-Type': 'application/json'}))


def make_error(error: str | dict[str, list[str] | str], code: int = 400):
    return make_resp(make_error_data(error, code), code)

