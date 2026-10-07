# Docker stacks (oval)

| File | Purpose |
|------|---------|
| [`compose.infra.yaml`](compose.infra.yaml) | Postgres |
| [`compose.yaml`](compose.yaml) | **Dev:** Postgres + Next.js (`app`) |
| [`compose.app.dev.yaml`](compose.app.dev.yaml) | Next.js dev container (included by `compose.yaml`) |
| [`compose.test.yaml`](compose.test.yaml) | Integration tests (infra only) |
| [`compose.e2e-support.yaml`](compose.e2e-support.yaml) | Mailpit for e2e |
| [`compose.app.e2e.yaml`](compose.app.e2e.yaml) | E2E app (`next start`) |
| [`Dockerfile.dev`](Dockerfile.dev) | Dev image for `app` |
| [`Dockerfile.e2e`](Dockerfile.e2e) | Production image for e2e `app` |

Environment:

- Profiles: [`env/profiles/`](env/profiles/)
- Generated: `env/<COMPOSE_PROJECT_NAME>.env` via `pnpm run task -- render-env`
- Optional override: `env/<project>.local.env` (gitignored; **required** for `BETTER_AUTH_SECRET` in dev)

Orchestration: [`pnpm run task`](../package.json) (see [`docs/engineering/local-dev.md`](../docs/engineering/local-dev.md)).

**One command dev:** `pnpm run task -- dev-up` — Postgres, migrations, Next dev in Docker (detached).

**After dependency changes:** `make dev-restart` — recreates `app` and runs [dev-app-entrypoint.sh](dev-app-entrypoint.sh) (`pnpm install` when lockfile hash changes).

**E2E:** `pnpm run task -- e2e-up` — Postgres, mailpit, migrate, `next start` in Docker (detached); `test-e2e` runs Playwright against it.
