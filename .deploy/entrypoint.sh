#!/bin/sh
set -e
cd /app
if [ -z "${DATABASE_URL:-}" ]; then
  echo "oval: DATABASE_URL is required" >&2
  exit 1
fi
echo "oval: applying database migrations…"
node ./node_modules/drizzle-kit/bin.cjs migrate
echo "oval: starting Next.js…"
exec node ./node_modules/next/dist/bin/next start -H 0.0.0.0 -p "${PORT:-3000}"
