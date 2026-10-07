#!/bin/sh
set -e
cd /app
if [ -z "${DATABASE_URL:-}" ]; then
  echo "oval: DATABASE_URL is required" >&2
  exit 1
fi
echo "oval: applying database migrations…"
pnpm exec drizzle-kit migrate
exec pnpm exec next start -H 0.0.0.0 -p 3000
