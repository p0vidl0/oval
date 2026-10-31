# Sourced by Lefthook (rc_file) and git-hook-run.sh. Git из GUI (Cursor) часто не видит node/pnpm.
# shellcheck shell=bash

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="${ROOT}/node_modules/.bin:/opt/homebrew/bin:/usr/local/bin:${PATH}"

if [ -d "${HOME}/.volta" ]; then
  export VOLTA_HOME="${HOME}/.volta"
  export PATH="${VOLTA_HOME}/bin:${PATH}"
fi

FNM_BIN="${HOME}/.local/share/fnm/fnm"
if [ -x "${FNM_BIN}" ]; then
  # shellcheck disable=SC2091
  eval "$("${FNM_BIN}" env)"
fi

if [ -s "${HOME}/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "${HOME}/.nvm/nvm.sh"
  if [ -f "${ROOT}/.nvmrc" ]; then
    nvm use --silent >/dev/null 2>&1 || true
  else
    nvm use default --silent >/dev/null 2>&1 || nvm use node --silent >/dev/null 2>&1 || true
  fi
fi

if ! command -v node >/dev/null 2>&1; then
  for nvm_node in "${HOME}/.nvm/versions/node/"*/bin; do
    if [ -x "${nvm_node}/node" ]; then
      export PATH="${nvm_node}:${PATH}"
      break
    fi
  done
fi

if [ -f "${HOME}/.asdf/asdf.sh" ]; then
  # shellcheck disable=SC1091
  . "${HOME}/.asdf/asdf.sh"
fi
