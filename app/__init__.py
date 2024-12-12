#import eventlet

from .classes import App


#eventlet.monkey_patch()
app = App()
db = app.db
app.init()
