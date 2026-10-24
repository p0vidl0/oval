#!/usr/bin/env bash
# Stream a custom-format dump of production database "oval" into ./backup/.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
host="${OVAL_SSH_HOST:-p0vidl0.info}"
container="${OVAL_PG_CONTAINER:-postgres}"
database="${OVAL_PG_DATABASE:-oval}"
pguser="${OVAL_PG_USER:-postgres}"
out_dir="${OVAL_BACKUP_DIR:-${root}/backup}"

ident='^[A-Za-z0-9_-]+$'
if [[ ! "$container" =~ $ident || ! "$database" =~ $ident || ! "$pguser" =~ $ident ]]; then
  echo "error: container, database, and user must match ${ident}" >&2
  exit 1
fi

mkdir -p "$out_dir"
stamp="$(date +%Y%m%d-%H%M%S)"
out="${out_dir}/oval-${stamp}.dump"
partial="${out}.partial"

cleanup() {
  rm -f "$partial"
}
trap cleanup EXIT

ssh -o BatchMode=yes -o ConnectTimeout=20 "$host" \
  "docker exec ${container} pg_dump -U ${pguser} -Fc -d ${database}" \
  >"$partial"

if [[ ! -s "$partial" ]]; then
  echo "error: empty dump" >&2
  exit 1
fi

magic="$(head -c 5 "$partial")"
if [[ "$magic" != "PGDMP" ]]; then
  echo "error: dump is not PostgreSQL custom format (expected PGDMP)" >&2
  exit 1
fi

mv "$partial" "$out"
trap - EXIT

echo "path=${out}"
ls -lh "$out"
if command -v file >/dev/null 2>&1; then
  file "$out"
fi
if command -v pg_restore >/dev/null 2>&1; then
  pg_restore -l "$out" | sed -n '1,16p'
fi
