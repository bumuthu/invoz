#!/usr/bin/env bash
# Upload inbound invoice CSVs for one environment.
#
# Local files:
#   invoices/<stag|prod>/{organization_id}/{legal_entity_id}/inbound/*.csv
# Destination:
#   s3://invoz-<env>-invoices/uploads/{organization_id}/{legal_entity_id}/inbound/*.csv
#
# The destination key is the same key an SFTP upload uses.
# A file is uploaded when that key is missing, or the local file is newer or a different size.
#
# Usage: sync.sh stag|prod
#        APP_ENV=stag sync.sh
set -euo pipefail

usage() {
  echo "usage: sync.sh stag|prod" >&2
  echo "uploads new invoices/<env>/{organization_id}/{legal_entity_id}/inbound/*.csv files to s3://invoz-<env>-invoices" >&2
  exit 1
}

if [[ $# -gt 1 ]]; then
  usage
fi

if [[ $# -eq 1 ]]; then
  export APP_ENV="$1"
fi

if [[ ! "${APP_ENV:-}" =~ ^(stag|prod)$ ]]; then
  usage
fi

source "$(dirname "$0")/../deployment/lib.sh"
require_aws

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required" >&2
  exit 1
fi

export AWS_PAGER=""

TOOL_DIR=$(cd "$(dirname "$0")" && pwd)
LOCAL_ROOT="$TOOL_DIR/invoices/$APP_ENV"

if [[ ! -d "$LOCAL_ROOT" ]]; then
  echo "invoice directory does not exist: $LOCAL_ROOT" >&2
  exit 1
fi

if ! aws s3api head-bucket --bucket "$INVOICE_BUCKET"; then
  echo "s3 bucket $INVOICE_BUCKET is not available" >&2
  exit 1
fi

echo "sync invoices/$APP_ENV -> s3://$INVOICE_BUCKET/uploads/"

pending=$(mktemp)
head_error=$(mktemp)
trap 'rm -f "$pending" "$head_error"' EXIT

ignored=0
while IFS= read -r file; do
  rel="${file#"$LOCAL_ROOT"/}"
  if [[ ! "$rel" =~ ^[^/]+/[^/]+/inbound/[^/]+\.csv$ ]]; then
    echo "ignored $rel"
    ignored=$((ignored + 1))
    continue
  fi
  printf '%s\t%s\n' "uploads/$rel" "$file" >>"$pending"
done < <(find "$LOCAL_ROOT" -type f ! -name '.*' | sort)

if [[ ! -s "$pending" ]]; then
  if [[ "$ignored" -eq 0 ]]; then
    echo "no invoice files in invoices/$APP_ENV"
  fi
  echo "uploaded 0, already in bucket 0, ignored $ignored"
  exit 0
fi

uploaded=0
already=0
while IFS=$'\t' read -r key file; do
  changed=0
  if head_json=$(aws s3api head-object --bucket "$INVOICE_BUCKET" --key "$key" --region "$REGION" --output json 2>"$head_error"); then
    if python3 -c 'import json,os,sys; from datetime import datetime,timezone; path,raw=sys.argv[1],sys.argv[2]; meta=json.loads(raw); stamp=meta["LastModified"].replace("Z","+00:00"); remote=datetime.fromisoformat(stamp).astimezone(timezone.utc).timestamp(); local=os.path.getmtime(path); raise SystemExit(0 if os.path.getsize(path)!=int(meta["ContentLength"]) or local>remote+1 else 1)' "$file" "$head_json"; then
      changed=1
    fi
  elif grep -Eq 'NotFound|404' "$head_error"; then
    changed=1
  else
    cat "$head_error" >&2
    exit 1
  fi
  if [[ "$changed" -eq 0 ]]; then
    # echo "already in bucket: $key"
    already=$((already + 1))
    continue
  fi
  aws s3 cp "$file" "s3://$INVOICE_BUCKET/$key" \
    --region "$REGION" \
    --content-type "text/csv" \
    --only-show-errors || exit 1
  echo "uploaded $key"
  uploaded=$((uploaded + 1))
done <"$pending"

echo "uploaded $uploaded, already in bucket $already, ignored $ignored"
