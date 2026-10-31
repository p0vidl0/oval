#!/usr/bin/env bash
# lefthook install + PATH/nvm для git-хуков (Cursor и др. GUI git).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"

pnpm exec lefthook install

hook_configured() {
  grep -qE "^${1}:" "${ROOT}/lefthook.yml"
}

patch_lefthook_hook() {
  local hook="$1"
  if [ ! -f "${hook}" ]; then
    return 0
  fi
  if ! grep -q 'call_lefthook' "${hook}" 2>/dev/null; then
    return 0
  fi

  local tmp
  tmp="$(mktemp)"
  {
    echo '#!/bin/bash'
    tail -n +2 "${hook}" | head -n 8
    cat <<'EOF'

# oval-git-hook-env
ROOT="$(git rev-parse --show-toplevel)"
# shellcheck disable=SC1091
source "${ROOT}/scripts/git-hook-env.sh"
if [ -z "${LEFTHOOK_BIN:-}" ]; then
  for candidate in \
    "${ROOT}"/node_modules/lefthook-*/bin/lefthook \
    "${ROOT}"/node_modules/.pnpm/lefthook-*/node_modules/lefthook-*/bin/lefthook; do
    if [ -x "${candidate}" ]; then
      export LEFTHOOK_BIN="${candidate}"
      break
    fi
  done
fi
EOF
    tail -n +11 "${hook}"
  } >"${tmp}"
  chmod +x "${tmp}"
  mv "${tmp}" "${hook}"
}

for name in prepare-commit-msg commit-msg pre-push post-commit; do
  hook="${ROOT}/.git/hooks/${name}"
  if [ -f "${hook}" ] && grep -q 'call_lefthook run' "${hook}" 2>/dev/null; then
    if ! hook_configured "${name}"; then
      rm -f "${hook}"
    fi
  fi
done

for name in pre-commit prepare-commit-msg commit-msg pre-push; do
  if hook_configured "${name}"; then
    patch_lefthook_hook "${ROOT}/.git/hooks/${name}"
  fi
done
