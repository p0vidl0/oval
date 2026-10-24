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

## Email OTP in tests

| Stack | Delivery | How tests read OTP |
|-------|----------|-------------------|
| **integration** | `EMAIL_PROVIDER=recording` | In-process [`recording-store`](../../lib/email/recording-store.ts) |
| **e2e** | `EMAIL_PROVIDER=smtp` → **MailSlurper** | [`tests/e2e/helpers/mailslurper.ts`](../../tests/e2e/helpers/mailslurper.ts) (HTTP API, как в corelayer) |

MailSlurper image: `ghcr.io/p0vidl0/mylslurper:2.0.0` in [`.docker/compose.infra.yaml`](../../.docker/compose.infra.yaml). Profile ports: `MAILSLURPER_*_HOST_PORT` in `oval-e2e`.

E2e app container uses `SMTP_HOST=mailslurper`; Playwright on the host uses `SMTP_PORT` / `MAILSLURPER_API_HOST_PORT` from [`.docker/env/oval-e2e.env`](../../.docker/env/oval-e2e.env).

## E2e helpers (no `/api/test/*`)

| Helper | Role |
|--------|------|
| [`tests/e2e/helpers/scenarios.ts`](../../tests/e2e/helpers/scenarios.ts) | Seed users / merge scenarios via Drizzle + `DATABASE_URL` |
| [`tests/e2e/helpers/mailslurper.ts`](../../tests/e2e/helpers/mailslurper.ts) | Poll OTP from MailSlurper |
| [`tests/e2e/helpers/payments.ts`](../../tests/e2e/helpers/payments.ts) | Latest `payment_id` for webhook |
| [`tests/e2e/helpers/telegram-auth.ts`](../../tests/e2e/helpers/telegram-auth.ts) | Bot intent + `POST /api/auth/sign-in/telegram/bot` |

## Payment webhook (integration / e2e)

`POST /api/webhooks/payment/mock` with `Authorization: Bearer $PAYMENT_WEBHOOK_SECRET`.

See [`payments.md`](payments.md).

## E2e feed seed

Before Playwright: `tsx tests/e2e/seed.ts` (called from `test-e2e`). Creates post **「E2E Night Ride」**.

## Layout

```
tests/unit/           — pure functions
tests/integration/    — Drizzle + Postgres
tests/e2e/            — Playwright
```

Helpers: [`tests/integration/helpers/`](../../tests/integration/helpers/), [`tests/e2e/helpers/`](../../tests/e2e/helpers/).

Patterns worth reusing:

- **Server action permissions** — [`server-actions-auth.test.ts`](../../tests/integration/server-actions-auth.test.ts) mocks `getServerSession`, `next/cache` and `next/navigation` (`redirect` throws a signal with the URL) and calls actions directly: guest / `user` get `Forbidden`, staff succeed. Add a case for every new admin action.
- **Migration backfill** — [`migrations-backfill.test.ts`](../../tests/integration/migrations-backfill.test.ts) creates a temporary database, migrates up to the last migration of the old model, inserts rows in old shapes, then applies the rest in one run. Add old-shape rows and assertions when a migration backfills data.
- **Mobile layout** — e2e at 375 px checks that row buttons stay inside the viewport (`admin-attendance.spec.ts`).

## CI

[`.github/workflows/test.yml`](../../.github/workflows/test.yml): unit job; integration job with Docker (when enabled).
