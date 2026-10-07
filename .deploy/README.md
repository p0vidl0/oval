# Деплой на VPS (Traefik + GHCR)

Образ собирается в GitHub Actions, пушится в **GHCR**, на сервер по **SSH** копируются compose, **`config.env`** (из репо) и **`secrets.env`** (только секреты из Actions).

## Файлы на сервере (`SSH_PATH`)

| Файл | Источник |
|------|----------|
| `config.env` | репозиторий [`.deploy/config.env`](config.env) — домен, Traefik, SMTP-хост, публичные URL |
| `secrets.env` | генерируется в CI при каждом деплое |
| `docker-compose.yaml` | репозиторий |

Шаблон секретов: [`secrets.env.example`](secrets.env.example).

## Каталог `.deploy`

| Файл | Назначение |
|------|------------|
| `Dockerfile` | Production-образ Next.js + миграции Drizzle при старте |
| `docker-compose.yaml` | Сервис `oval` за Traefik |
| `config.env` | Несекретный конфиг (редактируется в git) |
| `entrypoint.sh` | `drizzle-kit migrate` → `next start` |

## GitHub Actions

Workflow: [`.github/workflows/deploy-vps.yml`](../.github/workflows/deploy-vps.yml).

Триггер: push в `master` или `workflow_dispatch`.

### Secrets

**SSH:** `SSH_HOST`, `SSH_USER`, `SSH_KEY`, `SSH_PATH`, опционально `SSH_KNOWN_HOSTS`.

**Секреты приложения:** `DATABASE_URL`, `BETTER_AUTH_SECRET`, `SMTP_USER`, `SMTP_PASS`, `PAYMENT_WEBHOOK_SECRET`, опционально `TELEGRAM_*`.

Домен, Traefik, `BETTER_AUTH_URL`, лимиты proxy, параметры SMTP без пароля — в **`config.env`**, не в GitHub Secrets.

На сервере один раз: `docker login ghcr.io` (read packages), если образ приватный.

## Подготовка сервера (чеклист)

1. **Пользователь и каталог** — пользователь `oval`, каталог `SSH_PATH`, ключ деплоя, доступ к Docker.
2. **Postgres** — пользователь/БД `oval`, доступ с Docker (`host.docker.internal` в `DATABASE_URL`).
3. **Traefik** — та же external-сеть, что у omsk-bike (`TRAEFIK_NETWORK` в `config.env`).
4. Отредактировать **`config.env`** в репо (домен, URL), задать secrets в GitHub → деплой.

Миграции при каждом старте контейнера (`entrypoint.sh`).
