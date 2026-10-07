# Testing (oval)

## Commands

| Command | What |
|---------|------|
| `pnpm run test:unit` | Vitest, no Docker |
| `pnpm run task -- test-integration` | Postgres `oval-integration` + integration Vitest |
| `pnpm run task -- test-all` | unit + integration |
| `pnpm run task -- test-manual` | validate + test-all + test-e2e (полный ручной прогон) |
| `pnpm run task -- validate-full` | lint, build, unit |
| `pnpm run task -- test-e2e` | stack (app in Docker) → seed → **Playwright на хосте** → `:13001`. После seed тишина = `playwright install chromium` или прогон тестов |
| `pnpm run task -- e2e-up` | то же без Playwright (detached). `E2E_SKIP_BUILD=1` — без пересборки образа app |
| `make test-all` | same as task |

Integration sets `OVAL_INTEGRATION=1` and `DATABASE_URL` from [`.docker/env/oval-integration.env`](../../.docker/env/oval-integration.env).

Integration / e2e: после **успеха** `test-integration` / `test-e2e` всегда `down -v`. При **ошибке** — тоже, кроме отладки: `KEEP_INTEGRATION_STACK=1` or `KEEP_E2E_STACK=1`. Отдельно поднять e2e: `e2e-up`.

## Email OTP recording (tests)

- `EMAIL_PROVIDER=recording` — OTP stored in memory ([`lib/email/recording-store.ts`](../../lib/email/recording-store.ts)).
- `OVAL_TEST_API=1` — enables test routes (only in integration/e2e profiles; **не** включать в prod compose). Gate — этот флаг, не `NODE_ENV` (e2e идёт через `next start`).

| Route | Purpose |
|-------|---------|
| `GET /api/test/email/latest?email=…` | Last OTP for email |
| `GET /api/test/payments/latest?registration_id=` | Payment id for e2e webhook |

Profiles: `oval-integration`, `oval-e2e` — recording + API on. `oval-dev` — `OVAL_TEST_API=0`.

Prod / local with Mailpit: `EMAIL_PROVIDER=smtp`, `SMTP_HOST=127.0.0.1`, `SMTP_PORT=1025` (see profile `MAILPIT_SMTP_HOST_PORT`).

## Payment webhook (integration / e2e)

`POST /api/webhooks/payment/mock` with `Authorization: Bearer $PAYMENT_WEBHOOK_SECRET`.

See [`payments.md`](payments.md).

## E2E seed

Before Playwright: `tsx tests/e2e/seed.ts` (called from `test-e2e`). Creates post **「E2E Night Ride」**.

## Layout

```
tests/unit/           — pure functions
tests/integration/    — Drizzle + Postgres
tests/e2e/            — Playwright
```

Helpers: [`tests/integration/helpers/`](../../tests/integration/helpers/).

## CI

[`.github/workflows/test.yml`](../../.github/workflows/test.yml): unit job; integration job with Docker (when enabled).
