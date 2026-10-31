#!/usr/bin/env bash
# Обёртка для ключа `lefthook:` в lefthook.yml — нативный бинарник без node/pnpm.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
for candidate in \
  "${ROOT}"/node_modules/lefthook-*/bin/lefthook \
  "${ROOT}"/node_modules/.pnpm/lefthook-*/node_modules/lefthook-*/bin/lefthook; do
  if [ -x "${candidate}" ]; then
    exec "${candidate}" "$@"
  fi
done
echo "lefthook binary not found (run pnpm install)" >&2
exit 127
