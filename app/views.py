import importlib
import re
from os import path as op, walk

from . import app


for dirname, subdirs, files in walk(app.APPDIR):
    if dirname == app.APPDIR:
        continue
    subdirs[:] = []
    bpname = op.basename(dirname)
    if not re.match('[a-z][a-z0-9_]*', bpname) or 'views.py' not in files:
        continue
    app.logger.debug('Registering blueprint: %s', bpname)
    mod = importlib.import_module(f'.{bpname}.views', 'app')
    app.register_blueprint(mod.bp)
