import importlib
import logging
import os
import secrets
import sys
from typing import Any, Callable, Iterable, TypeVar, TYPE_CHECKING, cast
from os import path as op

import yaml
from flask import Flask, Blueprint

from .confs import ConfVal, ConfDict
from . import extensions

if TYPE_CHECKING:  # pragma: no cover
    from _typeshed.wsgi import StartResponse

_T = TypeVar('_T')


class App(Flask):
    APPDIR = op.abspath(op.dirname(__file__))
    ROOTDIR = op.dirname(APPDIR)
    HTMLDIR = os.environ.get('HTMLDIR', op.join(ROOTDIR, 'web/build'))
    CONFDIR = op.join(ROOTDIR, 'cfg')
    DATADIR = op.join(ROOTDIR, 'data')
    TEMP = op.join(DATADIR, 'temp')

    def setup_logger(self):
        logger = self.logger
        levels = {
            'ERROR': logging.ERROR, 'ERR': logging.ERROR,
            'WARNING': logging.WARNING, 'WARN': logging.WARNING,
            'INFO': logging.INFO, 'DEBUG': logging.DEBUG
        }
        level = os.environ.get('FLASK_LOGLEVEL', 'INFO').upper()
        logger.setLevel(levels.get(level, logging.INFO))
        if logger.handlers:
            if not sys.stdout.isatty():
                logger.handlers = []
                handler = logging.FileHandler(
                    op.join(self.ROOTDIR, 'var', 'log', 'app.log'), encoding='utf-8')
                logger.addHandler(handler)
            else:
                handler = logger.handlers[0]
            formatter = logging.Formatter('[%(asctime)-15s] [%(process)d] [%(levelname)s] in %(module)s: %(message)s')
            handler.setFormatter(formatter)

    def setup_config(self, config: ConfDict, *filenames: str) -> ConfDict:
        cfg_ready = ConfDict()
        class EmptyMiss(dict[str, Any]):
            def __missing__(self, key: Any):
                return ''

        def format_value(value: ConfVal, **replacement: Any) -> ConfVal:
            if isinstance(value, str):
                return value.format_map(EmptyMiss(os.environ, **replacement))
            if isinstance(value, list):
                return [format_value(val, **replacement) for val in value]
            if isinstance(value, dict):
                return {key: format_value(val, **replacement) for key, val in value.items()}
            return value

        for fname in filenames:
            try:
                with open(fname) as cfile:
                    cfg: ConfVal = yaml.safe_load(cfile)
                    if not cfg:
                        cfg = {}
                    if not isinstance(cfg, dict):
                        raise TypeError
            except (IOError, FileNotFoundError) as exc:
                self.logger.debug('Cannot read config file: %s', exc)
            except (TypeError, yaml.error.YAMLError):
                self.logger.warning('Invalid file format: expected yaml dict')
            else:
                for key in list(cfg.keys()):
                    cfg_ready[key] = cfg[key] = format_value(cfg[key], cfg={**config, **cfg_ready}, app=self)
                cfg_ready.update(cfg)
                self.logger.info('Loaded config: %s', fname)
        return cfg_ready

    def __init__(self):
        super().__init__(__name__, static_folder=self.HTMLDIR, static_url_path='')  # type: ignore
        self.setup_logger()
        self.config = ConfDict(self.config, **self.setup_config(ConfDict(self.config), op.join(self.CONFDIR, 'config.yaml')))
        cfiles = self.config.get_as('liststr', 'OTHER_CONFIGS')
        if cfiles:
            add_config = self.setup_config(self.config, *cfiles)
            for key, generator in (('SECRET_KEY', secrets.token_hex), ('SECURITY_PASSWORD_SALT', lambda: secrets.SystemRandom().getrandbits(128))):
                if key not in add_config:
                    last_fname = cfiles[-1]
                    generated = str(generator())
                    try:
                        with open(last_fname, 'a') as last_cfile:
                            last_cfile.write(f'{key}: {generated!r}\n')
                    except OSError:
                        self.logger.warning(f'Failed to write {key!r} to the {last_fname!r} file. Your setup may be insecure.')
                    else:
                        add_config[key] = generated
            self.config.update(add_config)

        self.APPNAME = self.config['str', 'APP_NAME']
        self.PREFIX = self.config.get_as('str', 'APP_ROOT') or '/'

        if self.PREFIX.lstrip('/'):
            wsgi_app = self.wsgi_app

            class PrefixWsgiApp:
                def __init__(self, prefix: str, app: Callable[[dict[str, str], 'StartResponse'], Iterable[bytes]]):
                    self.app, self. prefix = app, prefix

                def __call__(self, environ: dict[str, str], start_response: 'StartResponse'):
                    _, prefix, after = environ['PATH_INFO'].partition(self.prefix)
                    environ['SCRIPT_NAME'], environ['PATH_INFO'] = prefix, after
                    return wsgi_app(environ, start_response)

            self.wsgi_app = PrefixWsgiApp(self.PREFIX, self.wsgi_app)

        self.logger.debug('Database URL: %r', self.config['SQLALCHEMY_DATABASE_URI'])
        self.db = extensions.init_db(self)
        extensions.init_migrate(self, self.db)
        extensions.init_cors(self)
        self.sio = extensions.init_socketio(self)
        self.security = extensions.init_security()
        extensions.init_session(self)
        self.mail = extensions.init_mail(self)

    def get_config(self, key: str, val_type: type | tuple[type, ...], default: _T) -> _T:
        val = self.config.get(key, default) or default
        if val is default:
            return default
        if not isinstance(val, val_type):
            self.logger.warning('Configuration error: %s: invalid type', key)
            return default
        return cast(_T, val)

    def init(self):
        extensions.init_security_stage2(self)
        self.config['CORS_HEADERS'] = 'Content-Type'
        importlib.import_module('app.views')
        self.add_url_rule('/', view_func=lambda: self.send_static_file('index.html'))
        self.create_dirs()

    @staticmethod
    def create_blueprint(name: str, *args: Any, **kwargs: Any):
        bpname = name.rpartition('.')[0].partition('.')[2]
        return Blueprint(bpname, bpname, *args, **kwargs)

    def create_dirs(self):
        self.logger.debug(f"Creating dir {self.DATADIR}")
        os.makedirs(self.DATADIR, exist_ok=True)
        self.logger.debug(f"Creating dir {self.TEMP}")
        os.makedirs(self.TEMP, exist_ok=True)
