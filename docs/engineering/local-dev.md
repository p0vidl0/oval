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

Host-only tools (lint, unit tests) still use **pnpm on the host** with root `.env` or rendered env as today.

## Integration tests

```bash
pnpm run task -- test-integration
# debug: KEEP_INTEGRATION_STACK=1 pnpm run task -- test-integration
```

## E2E

```bash
pnpm run task -- e2e-up      # Postgres + MailSlurper + migrate + next start in Docker (-d)
pnpm run task -- test-e2e    # e2e-up + seed + Playwright (stack down after success)
# debug after failure: KEEP_E2E_STACK=1 pnpm run task -- test-e2e
pnpm run task -- e2e-down
```

## Telegram Bot API proxy (optional)

Если с сервера недоступен `api.telegram.org`, задайте **`TELEGRAM_API_ROOT`** — базовый URL reverse proxy (без слэша в конце), по тому же принципу, что `TELEGRAM_API_ROOT` в проекте society-bot. Запросы идут на `{TELEGRAM_API_ROOT}/bot<token>/<method>`.

Прокси должен проксировать официальный Bot API (тот же path `/bot…`). Webhook **входящий** по-прежнему на ваш `https://<domain>/api/webhooks/telegram`.

## Telegram OIDC proxy (optional)

Если с сервера недоступен `oauth.telegram.org`, задайте **`TELEGRAM_OIDC_ROOT`** — базовый URL reverse proxy (без слэша в конце). Серверные запросы идут на `{TELEGRAM_OIDC_ROOT}/token` и `{TELEGRAM_OIDC_ROOT}/.well-known/jwks.json`. Редirect браузера на `https://oauth.telegram.org/auth` не меняется. На одном Caddy-хосте можно совместить с Bot API, разведя пути (`/token`, `/.well-known/*` → oauth, остальное → api).

## Telegram login (optional)

Env (see [`.docker/env/oval-dev.local.env.example`](../../.docker/env/oval-dev.local.env.example)):

- **OIDC (сайт):** `TELEGRAM_OIDC_CLIENT_ID`, `TELEGRAM_OIDC_CLIENT_SECRET` — из @BotFather mini app → Bot Settings → **Web Login** (не путать с bot token).
- **Бот (deep link):** `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`.
- **Webhook бота:** `TELEGRAM_WEBHOOK_SECRET` — заголовок `X-Telegram-Bot-Api-Secret-Token` на `POST /api/webhooks/telegram`. В query секрет не передавать.

Prod / staging (OIDC):

1. Web Login → **Allowed URLs**: origin сайта (например `https://example.com`) и redirect  
   `https://<host>/api/auth/sign-in/telegram/oidc/callback`.
2. `setWebhook` для входа через бота — вручную, тем, у кого есть `TELEGRAM_BOT_TOKEN` (приложение и GitHub Actions это не вызывают). URL без секрета, секрет в `secret_token` (только `A–Z`, `a–z`, `0–9`, `_`, `-`):

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://<host>/api/webhooks/telegram","secret_token":"<TELEGRAM_WEBHOOK_SECRET>"}'
```

Если Bot API ходит через `TELEGRAM_API_ROOT`, тот же JSON отправляется на `{TELEGRAM_API_ROOT}/bot<token>/setWebhook`. Пока в Bot API висит старый URL с `?secret=`, вход через бота отвечает 401. Mini App и OIDC этот вебхук не используют.

На `localhost` OIDC нужен HTTPS-tunnel и те же URLs в BotFather; иначе — «Войти через Telegram (бот)».

В dev Better Auth сам принимает origin `*.ngrok-free.dev` (и localhost) для CSRF — **403 на `/telegram/oidc/start` после `dev-restart` не должно быть**, даже если `BETTER_AUTH_URL=http://localhost:3000`.

## VK ID (optional)

`VK_CLIENT_ID` и `VK_CLIENT_SECRET` в `oval-dev.local.env`. В кабинете VK ID redirect URI: `https://<host>/api/auth/callback/vk` (локально — туннель с HTTPS). Без этих переменных кнопка на `/login` не показывается. Если VK отдал email, он связывается с уже существующим пользователем; если нет — аккаунт создаётся без почты.

Опционально для webhook бота и явного redirect URI: **`BETTER_AUTH_URL=https://<ваш-ngrok-host>`** (без слэша) или **`NEXT_DEV_TUNNEL_HOST=<hostname>`** (без `https://`) в `oval-dev.local.env`.

### WebSocket `/_next/hmr` в консоли

Если сайт открыт через ngrok, а Next.js крутится в **`next dev`**, в консоли может быть ошибка `WebSocket connection to 'wss://…/_next/hmr' failed`. Это **Hot Module Reload**, не вход и не API. На логин Telegram **не влияет**; просто нет live-reload через tunnel.

- Можно **игнорировать** при проверке OIDC.
- Tunnel: `ngrok http 3000` (WebSocket проксируется; на free-tier иногда нестабильно).
- Без ошибки в консоли: открывать `http://localhost:3000` локально, ngrok — только для Telegram/BotFather.

Пользователи без email: первый вход через TG; привязка email в кабинете — позже (до этого вход по email создаст отдельный аккаунт). Нужна миграция `0008`/`0009` (`user.email` nullable): `pnpm run task -- db-migrate` или `dev-restart` (migrate перед пересозданием app).

Если после OIDC видите `null value in column "email"` — БД ещё без миграции; выполните migrate и повторите вход.

## Telegram Mini App (optional)

Тот же сайт открывается внутри Telegram (WebView). Вход — по подписанному **`initData`** (нужен **`TELEGRAM_BOT_TOKEN`**). OIDC в Mini App не используется.

1. BotFather → Mini App → **URL** публичного origin, например `https://<host>/feed` (или `/`).
2. **`TELEGRAM_BOT_TOKEN`**, **`TELEGRAM_BOT_USERNAME`** — как для бота.
3. Опционально **`TELEGRAM_MINI_APP_SHORT_NAME`** — short name из BotFather для ссылок вида  
   `https://t.me/<bot>/<short_name>?startapp=p_<postId>` (см. `lib/telegram/mini-app-start-param.ts`).

**Deep link (`start_param`):**

| Payload | Куда ведёт |
|---------|------------|
| `p_<postId>` | `/feed/<postId>` |
| `pay_<registrationId>` | `/cabinet/pay/<registrationId>` |

Локально — HTTPS tunnel (как для OIDC). Menu Button / тест — из клиента Telegram.

### Публикация в канал

- **`TELEGRAM_BOT_TOKEN`** — бот с правом постить в канал (админ).
- **`TELEGRAM_CHANNEL_ID`** — `@username` канала или numeric id `-100…`.
- В редакторе новой публикации / новой тренировки с анонсом — чекбокс **«Запостить в Telegram-канал»** (виден только если оба env заданы, при создании включён). На правке уже созданного поста флаг не меняется.
- Отправка при **первом выходе в ленту** (сразу или по расписанию через `scheduled-publisher`); очередь — таблица `feed_post_social_publishes`, повторно не шлёт при `status = sent`.
- Фото поста — **upload multipart** с диска `data/uploads` (Telegram не качает URL с сайта). **Анонс:** подпись — две строки расписания (🚴‍♂️ дата, 🕗 начало) и текст; новости — заголовок + текст.
- Отправка **не блокирует** сохранение: `after()` после ответа + догон раз в 30 с (`scheduled-publisher`). Не больше **10 отправок в час**. До **3 попыток** (`SOCIAL_PUBLISH_MAX_RETRIES`, по умолчанию 3), затем `status = failed`.

## Validate before merge

```bash
pnpm run task -- validate
```
