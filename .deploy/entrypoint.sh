#!/bin/sh
set -e
if [ -z "${DATABASE_URL:-}" ]; then
  echo "oval: DATABASE_URL is required" >&2
  exit 1
fi
echo "oval: applying database migrations…"
cd /app/migrate
node ./node_modules/drizzle-kit/bin.cjs migrate
cd /app
echo "oval: starting Next.js…"
exec node server.js
