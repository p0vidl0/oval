#!/bin/sh
# Runs before `next dev` in the dev app container. Ensures node_modules match lockfile.
set -e
cd /app

export CI=1

hash_deps() {
  # shellcheck disable=SC2002
  cat package.json pnpm-lock.yaml 2>/dev/null | sha256sum | awk '{print $1}'
}

install_deps() {
  echo "oval: pnpm install…"
  pnpm install
  rm -rf /app/.next
}

WANT="$(hash_deps)"
STAMP="/app/node_modules/.oval-deps-hash"
HAVE=""
if [ -f "$STAMP" ]; then
  HAVE="$(cat "$STAMP")"
fi

if [ "$WANT" != "$HAVE" ]; then
  echo "oval: package.json or pnpm-lock.yaml changed"
  install_deps
  echo "$WANT" > "$STAMP"
elif ! pnpm install --frozen-lockfile --prefer-offline; then
  echo "oval: node_modules out of sync with lockfile, repairing…"
  install_deps
  echo "$WANT" > "$STAMP"
fi

exec "$@"
