#!/bin/bash

export PROJECT_ROOT="$PWD"
PATH="$PROJECT_ROOT/.venv/bin:$PATH"

PIDFILE="$PROJECT_ROOT/var/run/gunicorn.pid"
set -ex

function cleanup() {
    pkill -F "$PIDFILE"
}

function logs() {
    tail -F var/log/gunicorn-access.log var/log/gunicorn-error.log var/log/app.log \
     var/log/redis-access.log var/log/redis-error.log
 }

[[ $POSTGRES_PASSWORD_FILE ]] && export POSTGRES_PASSWORD=$(cat $POSTGRES_PASSWORD_FILE)

./env.sh db upgrade
./env.sh exec supervisord -c "$PROJECT_ROOT/startup/supervisord/supervisord.conf" || exit 1
./env.sh exec supervisorctl -c "$PROJECT_ROOT/startup/supervisord/supervisord.conf" start redis || exit 1
#./env.sh exec supervisorctl -c "$PROJECT_ROOT/startup/supervisord/supervisord.conf" start celery || exit 1
[[ -f /tmp/debug ]] && echo "debug detected, not starting gunicorn" || ./env.sh gunicorn --log-level DEBUG

logs

trap cleanup EXIT
logs
