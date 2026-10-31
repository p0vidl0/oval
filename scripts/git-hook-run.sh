#!/usr/bin/env bash
# Обёртка для Lefthook: PATH + cwd в корне репо.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "${ROOT}/scripts/git-hook-env.sh"
cd "${ROOT}"
exec "$@"
