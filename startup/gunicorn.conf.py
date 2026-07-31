from os import environ as env

wsgi_app = env.get("FLASK_APP", "app:app")
bind = [env.get("GUNICORN_HOST", "0.0.0.0:8000")]
daemon = 'GUNICORN_NODAEMON' not in env
pidfile = env.get('GUNICORN_PID', "var/run/gunicorn.pid")
accesslog = env.get('GUNICORN_ACCESS_LOG', "var/log/gunicorn-access.log")
errorlog = env.get('GUNICORN_ERROR_LOG', "var/log/gunicorn-error.log")
workers = 4
max_requests = 1000
max_requests_jitter = 100
keepalive = 5
timeout = 900
worker_connections = 1000
worker_class = 'geventwebsocket.gunicorn.workers.GeventWebSocketWorker'
