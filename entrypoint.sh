#!/bin/bash

PATH=/code/.venv/bin:$PATH
PIDFILE=/code/var/run/gunicorn.pid
set -ex

function cleanup() {
    pkill -F "$PIDFILE"
}

[[ $1 ]] && echo "ORIGINS: '$1'" >> cfg/config_local.yaml

cat >gunicorn.conf.py <<EOF
wsgi_app = "app:app"
bind = ["0.0.0.0:8000"]
daemon = True
pidfile = "$PIDFILE"
accesslog = "/code/var/log/gunicorn-access.log"
errorlog = "/code/var/log/gunicorn-error.log"
workers = 1
max_requests = 1000
max_requests_jitter = 100
keepalive = 5
timeout = 120
worker_connections = 1000
worker_class = 'eventlet'
EOF

mkdir -p /code/supervisord/conf.d/

cat >/code/supervisord/supervisord.conf <<EOF
[unix_http_server]
file=/code/supervisord/supervisor.sock   ; (the path to the socket file)

[supervisord]
logfile=/code/supervisord/supervisord.log   ; (the path to the log file)
logfile_maxbytes=50MB
logfile_backups=10
loglevel=info
pidfile=/code/supervisord/supervisord.pid   ; (the path to the PID file)
minfds=1024
minprocs=200

[rpcinterface:supervisor]
supervisor.rpcinterface_factory = supervisor.rpcinterface:make_main_rpcinterface

[supervisorctl]
serverurl=unix:///code/supervisord/supervisor.sock

[include]
files = /code/supervisord/conf.d/*.conf
EOF


cat >/code/supervisord/conf.d/redis.conf <<EOF
[program:redis]
command=redis-server
directory=/code
autostart=false
autorestart=true
stderr_logfile=/code/var/log/redis-error.log
stdout_logfile=/code/var/log/redis-access.log
EOF
mkdir -p var/log var/run

./ctl flask db upgrade

./ctl env shell -- -c "supervisord -c /code/supervisord/supervisord.conf && \
 supervisorctl -c /code/supervisord/supervisord.conf start redis"
./ctl env run gunicorn

trap cleanup EXIT
tail -F var/log/gunicorn-access.log var/log/gunicorn-error.log var/log/app.log \
 var/log/redis-access.log var/log/redis-error.log
