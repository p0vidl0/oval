# Local dev & test stacks

**Docker for Postgres + Next.js dev**, **profiles** for port isolation (integration/e2e).

## Task runner

```bash
pnpm install
cp .docker/env/oval-dev.local.env.example .docker/env/oval-dev.local.env
# set BETTER_AUTH_SECRET in oval-dev.local.env

pnpm run task -- dev-up    # Postgres + migrate + Next.js in Docker (-d)
# same:
make dev-up
pnpm run task -- dev-down  # stop app + Postgres
```

После смены зависимостей достаточно **`make dev-restart`** (или `pnpm run task -- dev-restart`): контейнер app **пересоздаётся**, entrypoint [`.docker/dev-app-entrypoint.sh`](../../.docker/dev-app-entrypoint.sh) сравнивает hash `package.json` + `pnpm-lock.yaml` и при необходимости делает `pnpm install`.

Не используйте `docker restart` — он **не** заново запускает command/entrypoint. Если install всё же сломался, сбросьте том: `docker volume rm oval-dev_dev_node_modules`, затем `dev-up`.

Optional [GNU Make](../../Makefile) forwards the same commands.

## Production VPS

Деплой на тот же Traefik/VPS, что и omsk-bike: образ в GHCR, конфиги в [`.deploy/`](../../.deploy/), workflow [`.github/workflows/deploy-vps.yml`](../../.github/workflows/deploy-vps.yml). Подробности и чеклист сервера — [`.deploy/README.md`](../../.deploy/README.md).

## Compose projects

| Profile | `COMPOSE_PROJECT_NAME` | Postgres host port | App URL |
|---------|------------------------|--------------------|---------|
| Daily dev | `oval-dev` | 5433 | http://localhost:3000 |
| Integration | `oval-integration` | 15433 | — |
| E2E | `oval-e2e` | 15434 | Playwright `:13001` on host |

Generated env: `.docker/env/<project>.env` via `pnpm run task -- render-env [project]`.

Secrets: [`.docker/env/oval-dev.local.env`](../../.docker/env/oval-dev.local.env) (`BETTER_AUTH_SECRET`) — mounted into the dev container when present.

Host-only tools (lint, unit tests, `user:role`) still use **pnpm on the host** with root `.env` or rendered env as today.

## Integration tests

```bash
pnpm run task -- test-integration
# debug: KEEP_INTEGRATION_STACK=1 pnpm run task -- test-integration
```

## E2E

```bash
pnpm run task -- e2e-up      # Postgres + mailpit + migrate + next start in Docker (-d)
pnpm run task -- test-e2e    # e2e-up + seed + Playwright (stack down after success)
# debug after failure: KEEP_E2E_STACK=1 pnpm run task -- test-e2e
pnpm run task -- e2e-down
```

## Telegram login (optional)

Env (see [`.docker/env/oval-dev.local.env.example`](../../.docker/env/oval-dev.local.env.example)):

- **OIDC (сайт):** `TELEGRAM_OIDC_CLIENT_ID`, `TELEGRAM_OIDC_CLIENT_SECRET` — из @BotFather mini app → Bot Settings → **Web Login** (не путать с bot token).
- **Бот (deep link):** `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`.
- **Webhook бота:** `TELEGRAM_WEBHOOK_SECRET` — query `secret` для `POST /api/webhooks/telegram`.

Prod / staging (OIDC):

1. Web Login → **Allowed URLs**: origin сайта (например `https://example.com`) и redirect  
   `https://<host>/api/auth/sign-in/telegram/oidc/callback`.
2. `setWebhook` → `https://<host>/api/webhooks/telegram?secret=<TELEGRAM_WEBHOOK_SECRET>` (для входа через бота).

На `localhost` OIDC нужен HTTPS-tunnel и те же URLs в BotFather; иначе — «Войти через Telegram (бот)».

В dev Better Auth сам принимает origin `*.ngrok-free.dev` (и localhost) для CSRF — **403 на `/telegram/oidc/start` после `dev-restart` не должно быть**, даже если `BETTER_AUTH_URL=http://localhost:3000`.

Опционально для webhook бота и явного redirect URI: **`BETTER_AUTH_URL=https://<ваш-ngrok-host>`** (без слэша) или **`NEXT_DEV_TUNNEL_HOST=<hostname>`** (без `https://`) в `oval-dev.local.env`.

### WebSocket `/_next/hmr` в консоли

Если сайт открыт через ngrok, а Next.js крутится в **`next dev`**, в консоли может быть ошибка `WebSocket connection to 'wss://…/_next/hmr' failed`. Это **Hot Module Reload**, не вход и не API. На логин Telegram **не влияет**; просто нет live-reload через tunnel.

- Можно **игнорировать** при проверке OIDC.
- Tunnel: `ngrok http 3000` (WebSocket проксируется; на free-tier иногда нестабильно).
- Без ошибки в консоли: открывать `http://localhost:3000` локально, ngrok — только для Telegram/BotFather.

Пользователи без email: первый вход через TG; привязка email в кабинете — позже (до этого вход по email создаст отдельный аккаунт). Нужна миграция `0008`/`0009` (`user.email` nullable): `pnpm run task -- db-migrate` или `dev-restart` (migrate перед пересозданием app).

Если после OIDC видите `null value in column "email"` — БД ещё без миграции; выполните migrate и повторите вход.

## Validate before merge

```bash
pnpm run task -- validate
```
