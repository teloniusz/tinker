run:
	export USERID=$$(id -u); \
	mkdir -p data/db; \
	docker compose up -d && \
	{ docker compose logs --follow --tail=200 || true; }

build:
	USERID=$$(id -u) docker compose build

rebuild:
	export USERID=$$(id -u); \
	docker builder prune && \
	docker compose build

debug:
	mkdir -p data/debug data/db; \
	export USERID=$$(id -u); \
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d && \
	sleep 1 && \
	{ docker compose exec python \
		bash -c '\
			set -x; \
			export PATH=$$PATH:~/.venv/bin; \
			pkill -F var/run/gunicorn.pid; \
			sleep 2; \
			sed -ri "/^(daemon|accesslog|errorlog) =/s/^/\# /" gunicorn.conf.py ; \
			gunicorn --reload; \
			echo "ok!"; \
			bash; \
		' 	|| { echo "failed!"; bash; true; }; \
		docker compose down; \
	}

debug-py:
	NGINX_CONF=./nginx-prod.conf $(MAKE) debug

.PHONY: debug debug-py