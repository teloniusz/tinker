from gevent import monkey
monkey.patch_all()

from .classes import App

app = App()
db = app.db
app.init()
