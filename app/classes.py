import importlib
import logging
import os
import sys
from typing import Any, Callable, Iterable, TypeVar, cast
from os import path as op
from wsgiref.types import StartResponse

import yaml
from flask import Flask, Blueprint

from .confs import ConfVal, ConfDict
from . import extensions


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

    def setup_config(self, *filenames: str):
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
                    config: ConfVal = yaml.safe_load(cfile)
                    if not config:
                        config = {}
                    if not isinstance(config, dict):
                        raise TypeError
            except (IOError, FileNotFoundError) as exc:
                self.logger.debug('Cannot read config file: %s', exc)
            except (TypeError, yaml.error.YAMLError):
                self.logger.warning('Invalid file format: expected yaml dict')
            else:
                cfg_ready = self.config.copy()
                for key in list(config.keys()):
                    cfg_ready[key] = config[key] = format_value(config[key], cfg=cfg_ready, app=self)
                self.config.update(config)  # type: ignore
                self.logger.info('Loaded config: %s', fname)

    def __init__(self):
        super().__init__(__name__, static_folder=self.HTMLDIR, static_url_path='')  # type: ignore
        self.config = ConfDict(self.config)
        self.setup_logger()
        self.setup_config(op.join(self.CONFDIR, 'config.yaml'))
        cfiles = self.config.get('OTHER_CONFIGS')
        if cfiles and isinstance(cfiles, (list, str)):
            if isinstance(cfiles, str):
                cfiles = [cfiles]
            self.setup_config(*(str(cfile) for cfile in cfiles))
        self.APPNAME = self.config['str', 'APP_NAME']
        self.PREFIX = self.config.get_as('str', 'APP_ROOT') or '/'

        if self.PREFIX.lstrip('/'):
            wsgi_app = self.wsgi_app

            class PrefixWsgiApp:
                def __init__(self, prefix: str, app: Callable[[dict[str, str], StartResponse], Iterable[bytes]]):
                    self.app, self. prefix = app, prefix

                def __call__(self, environ: dict[str, str], start_response: StartResponse):
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
