# tINKer

tINKer is a React and Flask-based UI application for helping with ink elemental composition analysis.

## Installation

1. Clone the repository with submodules

```bash
git clone https://github,com/teloniusz/tinker.git --recurse-submodules
cd tinker/
```

2. Initialize the default SQLite database
```bash
./ctl flask db upgrade
```

## Usage

To run a development server:
```bash
$ ./ctl run
INFO:runlib:Calling command: run with args:
...
INFO:app.classes:Registering blueprint: base
 * Serving Flask app 'app'
 * Debug mode: off
INFO:werkzeug:WARNING: This is a development server. Do not use it in a production deployment. Use a production WSGI server instead.
 * Running on http://127.0.0.1:5000
INFO:werkzeug:Press CTRL+C to quit
```
To run a server on a specified host/port:
```bash
$ ./ctl run --host 0.0.0.0 -p 18000
INFO:runlib:Calling command: run with args: host: '0.0.0.0' port: '18000'
...
```
To start a uWSGI server with a HTTP interface:
```bash
$ ./ctl uwsgi start -s 0.0.0.0:18000
INFO:runlib:Calling command: uwsgi with args: start socket: '0.0.0.0:18000' plugin: 'python3'
[uWSGI] getting INI configuration from config.ini
INFO:runlib:UWSGI process started and daemonized
```
Logfile can be found in `./var/log/uwsgi.log`.

To start a uWSGI server with Unix domain socket interface (for proxying from Apache, nginx or other HTTP server with uWSGI support):
```bash
$ ./ctl uwsgi start -s /path/to/socket
INFO:runlib:Calling command: uwsgi with args: start socket: '0.0.0.0:18000' plugin: 'python3'
[uWSGI] getting INI configuration from config.ini
INFO:runlib:UWSGI process started and daemonized
```

To stop uWSGI server:
```bash
$ ./ctl uwsgi stop
INFO:runlib:Calling command: uwsgi with args: stop
INFO:runlib:UWSGI process stopped
```

To run a development docker compose (with app/ and web/ bind-mounted inside, requires updating `web/node_modules` by `npm ci`/`npm i` run in `web/`):
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

To run production docker instances:
```bash
docker compose up
```

Last two calls may require adding a `--build` option or running `docker builder prune` to get rid of build cache if significant changes were introduced.

## Development

### Virtual environment

To add (or upgrade) a pip package:
```bash
./ctl env add <package>
```
To remove a pip package:
```bash
./ctl env rm <package>
```
List env packages:
```bash
./ctl env list
```
To upgrade existing packages (those without version specified):
```bash
./ctl env upgrade
```
To freeze packages at currently installed versions:
```bash
./ctl env freeze
```
To enter virtual env shell:
```bash
./ctl env
```

### Flask and database

To execute a flask command:
```bash
./ctl flask <command>
```

To enter Python flask shell with initialized `app`:
```bash
$ ./ctl flask shell
INFO:runlib:Calling command: flask with args: "shell"
(...)
INFO:app.classes:Registering blueprint: base
Python 3.9.2 (default, Feb 28 2021, 17:03:44) 
[GCC 10.2.1 20210110] on linux
App: app.classes
Instance: /home/students/inf/a/ag181044/projects/masserfront/instance
>>> app
<App 'app.classes'>
```

To create a migration in `migrations/versions/` after changes to a SQLAlchemy Python model:
```
./ctl flask db migrate
```

To upgrade database to the newest schema version:
```
./ctl flask db upgrade
```

## Authors and acknowledgment

Antoni Goldstein

## License

All rights reserved (for now).

## Project status

In statu nascendi
