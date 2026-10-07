# Ночная Лига (oval)

Next.js + PostgreSQL + Drizzle + Better Auth (email OTP). План: [`PLAN.md`](PLAN.md).

## Локальный запуск

**pnpm** (см. `packageManager` в [`package.json`](package.json); `corepack enable` при необходимости).

```bash
pnpm install
cp .env.example .env   # опционально; секреты лучше в .docker/env/oval-dev.local.env
cp .docker/env/oval-dev.local.env.example .docker/env/oval-dev.local.env
# BETTER_AUTH_SECRET: openssl rand -base64 32

pnpm run task -- dev-up   # Postgres + migrate + Next.js в Docker (-d)
pnpm run task -- dev-down # остановить app + Postgres
```

Тот же интерфейс через Make: `make dev-up`, `make dev`. Подробнее: [`docs/engineering/local-dev.md`](docs/engineering/local-dev.md).

Вход: http://localhost:3000/login — OTP в логе dev-сервера (`[email stub] …`).

Роль editor/admin после первого входа:

```bash
pnpm run user:role -- you@example.com admin
```

## Тесты

```bash
pnpm run task -- validate           # biome + production build
pnpm run task -- test-integration   # стек oval-integration + vitest
```

## Скрипты

| Команда | Назначение |
|---------|------------|
| `pnpm run task -- help` | Все dev/test команды |
| `pnpm run dev` | Next.js (без compose env — используй `task dev`) |
| `pnpm run lint` | Biome check |
| `pnpm run build` | Production build |
| `pnpm run auth:generate` | Better Auth Drizzle schema |
| `pnpm run db:migrate` | Migrations (нужен `DATABASE_URL`) |
| `pnpm run user:role` | Назначить роль по телефону |

## Агенты

См. [`AGENTS.md`](AGENTS.md) и [`.agents/README.md`](.agents/README.md).
