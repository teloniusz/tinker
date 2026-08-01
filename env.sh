#!/bin/bash

# . ./env.sh                     - set up, update and enter the virtual environment
# ./env.sh                       - set up and update the venv
# ./env.sh <command> [args...]   - as above, then run one of the commands defined as :command() or ::command()
#                                  function below. If both are defined, the last one overwrites.
# ./env.sh -h | --help           - show available operations

app=$(python -c '
import tomllib as t
project = t.load(open("pyproject.toml", "rb"))["project"]
print(project.get("description", project["name"]))')

here=$(dirname "${BASH_SOURCE[0]}")
startup_dir="startup"
cd "$here"

. ./tools.sh

setup_env() {
    if ! [[ -f .venv/bin/activate ]]; then
        ok "Creating venv" python3 -m venv .venv        || return
    fi
    if [[ $VIRTUAL_ENV != $(readlink -f .venv) ]]; then
        ok "Activating env" . .venv/bin/activate        || return
    fi
    if ! which pip-compile >/dev/null; then
        ok "Installing pip-tools" pip install pip-tools || return
    fi
    if [[ pyproject.toml -nt requirements.txt || requirements.in -nt requirements.txt ]]; then
        [[ -f requirements.in ]] && sources="pyproject.toml requirements.in" || sources="pyproject.toml"
        ok "Compiling requirements file" python -m piptools compile --strip-extras -q $sources   || return
    fi
    ok "Syncing requirements" python -m piptools sync -q
}

prepare_run() {
    pg_pass_file="$startup_dir/postgres-pass.txt"
    [[ -n $POSTGRES_PASSWORD_FILE || -f "$pg_pass_file" ]] || tr -dc 'A-Za-z0-9_.-' < /dev/urandom | head -c 25 > "$pg_pass_file"
    echo
    mkdir -pv data/ data/db var/log var/run
    touch cfg/config_local.yaml
}

:flask() {
    : "Wrapper for flask"
    prepare_run
    flask "${@:-shell}"
}

:db() {
    : "Wrapper for flask db"
    :flask db "$@"
}

:migrate() {
    : "Migrate database"
    :db migrate "$@"
}

:gunicorn() {
    : "Prepare and run gunicorn"
    prepare_run
    gunicorn -c startup/gunicorn.conf.py "$@"
}

:grun() {
    : "Run gunicorn in the foreground"
    export GUNICORN_NODAEMON=1 GUNICORN_HOST=0.0.0.0:5000
    :gunicorn --log-file /dev/stderr --access-logfile /dev/stderr --timeout 900000
}

::web() {
    : "Run React frontend in the foreground"
    cd web/
    [[ $1 = quick ]] || npm i
    BROWSER=none npm start
}

:run() {
    : "Local backend + frontend + nginx run"
    cleanup() {
        docker stop tinker-local
    }
    docker run --name tinker-local --rm -d \
        --network host \
        -v "$PWD/startup/nginx-local.conf:/etc/nginx/conf.d/default.conf" \
        nginx:1.24.0 || { echo "Failed to run docker nginx"; return; }
    trap cleanup EXIT
    [[ " $@ " =~ \ noweb\  ]] || ::web quick &
    if [[ " $@ " =~ \ noback\  ]]; then
        docker attach tinker-local
    else
        :grun
    fi
}

docker_dir=$startup_dir
. ./env-docker.sh

::cdebug() {
    : "Docker compose run with interactive debug"
    ::compose_dev up -d || exit 1
    sleep 2
    local runscript=$(cat <<EOS
set -x
touch /tmp/debug
export PATH=\$PATH:~/.venv/bin
pkill -F var/run/gunicorn.pid || true
sleep 1
[[ \$ENV_UPDATE ]] && ./ctl env update
sed -ri "/^(daemon|accesslog|errorlog) =/s/^/\# /" startup/gunicorn.conf.py
./env.sh gunicorn --log-level info
echo "ok!"
bash
EOS
)
    ::compose_dev exec python bash -c "$runscript"
}

echo "$_Wht * $_rst $app $_Wht *$_rst"
go "$@"
