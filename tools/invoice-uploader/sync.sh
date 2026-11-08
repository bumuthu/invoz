#!/usr/bin/env bash
# Upload inbound invoice CSVs through SFTP.
#
# Local files:
#   invoices/<stag|prod>/{organization_slug}/{legal_entity_id}/{branch_id}/inbound/*.csv
# SFTP path, as the organization user:
#   /{legal_entity_id}/{branch_id}/inbound/{file}.csv
#
# That user is chrooted at uploads/{organization_id}/, so the object lands on the
# same key a customer upload uses. A file is sent when the remote file is missing
# or a different size.
#
# Connection details are tools/invoice-uploader/sftp/<slug>.env:
#   SFTP_HOST, SFTP_USERNAME, SFTP_PASSWORD
# npm run onboard:sftp -- <stag|prod> <slug> writes that file.
#
# Usage: sync.sh stag|prod [organization slug]
set -euo pipefail

usage() {
  echo "usage: sync.sh stag|prod [organization slug]" >&2
  echo "uploads invoices/<env>/<slug>/{legal_entity_id}/{branch_id}/inbound/*.csv" >&2
  exit 1
}

if [[ $# -lt 1 || $# -gt 2 ]]; then
  usage
fi

export APP_ENV="$1"
SLUG="${2:-}"

if [[ ! "$APP_ENV" =~ ^(stag|prod)$ ]]; then
  usage
fi
if [[ -n "$SLUG" && ! "$SLUG" =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$ ]]; then
  echo "organization slug must be a hostname label" >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required" >&2
  exit 1
fi

TOOL_DIR=$(cd "$(dirname "$0")" && pwd)
LOCAL_ROOT="$TOOL_DIR/invoices/$APP_ENV"

if [[ ! -d "$LOCAL_ROOT" ]]; then
  echo "invoice directory does not exist: $LOCAL_ROOT" >&2
  exit 1
fi
if [[ -n "$SLUG" && ! -d "$LOCAL_ROOT/$SLUG" ]]; then
  echo "invoice directory does not exist: $LOCAL_ROOT/$SLUG" >&2
  exit 1
fi

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
pending="$work/pending.tsv"

ignored=0
while IFS= read -r file; do
  rel="${file#"$LOCAL_ROOT"/}"
  if [[ ! "$rel" =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?/[1-9][0-9]*/[1-9][0-9]*/inbound/[^/]+\.csv$ && ! "$rel" =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?/[1-9][0-9]*/inbound/[^/]+\.csv$ ]]; then
    echo "ignored $rel"
    ignored=$((ignored + 1))
    continue
  fi
  org="${rel%%/*}"
  if [[ -n "$SLUG" && "$org" != "$SLUG" ]]; then
    continue
  fi
  rest="${rel#*/}"
  printf '%s\t/%s\t%s\n' "$org" "$rest" "$file" >>"$pending"
done < <(find "$LOCAL_ROOT" -type f ! -name '.*' | sort)

if [[ ! -s "$pending" ]]; then
  if [[ "$ignored" -eq 0 ]]; then
    echo "no invoice files in invoices/$APP_ENV${SLUG:+/$SLUG}"
  fi
  echo "uploaded 0, unchanged 0, ignored $ignored"
  exit 0
fi

load_login() {
  local slug="$1"
  local env_file="$TOOL_DIR/sftp/${slug}.env"
  local parsed status
  if [[ ! -f "$env_file" ]]; then
    echo "missing SFTP connection file: tools/invoice-uploader/sftp/${slug}.env" >&2
    echo "copy tools/invoice-uploader/sftp/env.example and set SFTP_HOST, SFTP_USERNAME, and SFTP_PASSWORD" >&2
    exit 1
  fi
  set +e
  parsed=$(SFTP_ENV="$env_file" python3 - <<'PY'
import os, sys
path = os.environ["SFTP_ENV"]
values = {}
for raw in open(path, encoding="utf-8"):
    line = raw.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    if line.startswith("export "):
        line = line[len("export "):].strip()
    key, value = line.split("=", 1)
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
        value = value[1:-1]
    values[key.strip()] = value
host = values.get("SFTP_HOST", "")
user = values.get("SFTP_USERNAME", "")
password = values.get("SFTP_PASSWORD", "")
missing = [name for name, value in (("SFTP_HOST", host), ("SFTP_USERNAME", user), ("SFTP_PASSWORD", password)) if not value]
if missing:
    sys.stderr.write(f"{path} is missing {', '.join(missing)}\n")
    sys.exit(2)
sys.stdout.write(f"{host}\n{user}\n{password}\n")
PY
  )
  status=$?
  set -e
  if [[ "$status" -ne 0 ]]; then
    printf '%s\n' "$parsed" >&2
    exit 1
  fi
  SFTP_HOST=$(printf '%s\n' "$parsed" | sed -n '1p')
  SFTP_USER=$(printf '%s\n' "$parsed" | sed -n '2p')
  SFTP_PASSWORD=$(printf '%s\n' "$parsed" | sed -n '3p')
}

PYDEPS="$TOOL_DIR/.pydeps"
if ! PYTHONPATH="$PYDEPS" python3 -c 'import paramiko' >/dev/null 2>&1; then
  python3 -m pip install --quiet --target "$PYDEPS" paramiko
fi

uploaded=0
unchanged=0

while IFS= read -r org; do
  load_login "$org"
  echo "sftp ${SFTP_USER}@${SFTP_HOST}"
  if ! result=$(
    PYTHONPATH="$PYDEPS" \
    SFTP_HOST="$SFTP_HOST" \
    SFTP_USERNAME="$SFTP_USER" \
    SFTP_PASSWORD="$SFTP_PASSWORD" \
    PENDING="$pending" \
    ORG="$org" \
    python3 - <<'PY'
import os
import sys

import paramiko

host = os.environ["SFTP_HOST"]
user = os.environ["SFTP_USERNAME"]
password = os.environ["SFTP_PASSWORD"]
org = os.environ["ORG"]
pending = os.environ["PENDING"]

transport = paramiko.Transport((host, 22))
try:
    transport.connect(username=user, password=password)
except paramiko.AuthenticationException:
    sys.stderr.write("SFTP login failed\n")
    sys.exit(1)
sftp = paramiko.SFTPClient.from_transport(transport)

def ensure_directory(path):
    current = ""
    for part in [piece for piece in path.split("/") if piece]:
        current += "/" + part
        try:
            sftp.stat(current)
        except OSError:
            sftp.mkdir(current)

uploaded = 0
unchanged = 0
try:
    for raw in open(pending, encoding="utf-8"):
        row_org, remote, local = raw.rstrip("\n").split("\t", 2)
        if row_org != org:
            continue
        try:
            remote_size = sftp.stat(remote).st_size
        except OSError:
            remote_size = None
        if remote_size == os.path.getsize(local):
            unchanged += 1
            continue
        ensure_directory(remote.rsplit("/", 1)[0])
        sftp.put(local, remote)
        print(f"uploaded {remote}")
        uploaded += 1
finally:
    sftp.close()
    transport.close()
print(f"{uploaded} {unchanged}")
PY
  ); then
    echo "SFTP upload failed for organization $org" >&2
    exit 1
  fi
  while IFS= read -r line; do
    if [[ "$line" == uploaded\ * ]]; then
      echo "$line"
    else
      counts="$line"
    fi
  done <<<"$result"
  org_uploaded=${counts%% *}
  org_unchanged=${counts##* }
  uploaded=$((uploaded + org_uploaded))
  unchanged=$((unchanged + org_unchanged))
done < <(cut -f1 "$pending" | sort -u)

echo "uploaded $uploaded, unchanged $unchanged, ignored $ignored"
