ifeq (compose,$(firstword $(MAKECMDGOALS)))
  RUN_ARGS := $(wordlist 2,$(words $(MAKECMDGOALS)),$(MAKECMDGOALS))
  $(eval $(RUN_ARGS):dummy;@:)
endif

VARS := USERID=$$(id -u)

start:
	export $(VARS); \
	mkdir -p data/db; \
	[[ -f cfg/config_prod.yaml ]] && touch cfg/config_prod.yaml; \
	docker compose up -d

run:
	$(MAKE) start && \
	{ docker compose logs --follow --tail=200 || true; }

stop:
	$(MAKE) compose down

build:
	$(VARS) docker compose build

rebuild:
	export $(VARS); \
	[[ -f cfg/config_prod.yaml ]] && touch cfg/config_prod.yaml; \
	docker builder prune && \
	docker compose build

debug:
	mkdir -p data/debug data/db; \
	[[ -f cfg/config_prod.yaml ]] && touch cfg/config_prod.yaml; \
	export $(VARS); \
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d || exit 1; \
	sleep 2; \
	{ docker compose exec python \
		bash -c '\
			set -x; \
			touch /tmp/debug; \
			export PATH=$$PATH:~/.venv/bin; \
			pkill -F var/run/gunicorn.pid || true; \
			sleep 1; \
			[[ $$ENV_UPDATE ]] && ./ctl env update; \
			sed -ri "/^(daemon|accesslog|errorlog) =/s/^/\# /" gunicorn.conf.py ; \
			gunicorn --log-level info; \
			echo "ok!"; \
			bash; \
		' 	|| { echo "failed!"; bash; true; }; \
		docker compose down; \
	}
compose:
	export $(VARS); \
	docker compose -f docker-compose.yml -f docker-compose.dev.yml $(RUN_ARGS)

debug-py:
	NGINX_CONF=./nginx-prod.conf $(MAKE) debug

dummy:

.PHONY: debug debug-py compose dummy start stop run
