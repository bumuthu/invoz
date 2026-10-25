#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "$DEPLOY_DIR/../.." && pwd)
BUILD_DIR="$DEPLOY_DIR/.build"

REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-ap-south-1}}"
export AWS_REGION="$REGION"
export AWS_DEFAULT_REGION="$REGION"

if [[ ! "${APP_ENV:-}" =~ ^(stag|prod)$ ]]; then
  echo "APP_ENV must be stag or prod" >&2
  exit 1
fi

aws_name() {
  printf 'invoz-%s-%s' "$APP_ENV" "$1"
}

INVOICE_BUCKET="$(aws_name invoices)"
QUEUE_NAME="$(aws_name invoicing-pipeline).fifo"
DLQ_NAME="$(aws_name invoicing-pipeline-dlq).fifo"
FUNCTION_NAME="$(aws_name invoice-engine)"
ROLE_NAME="${FUNCTION_NAME}-role"
RULE_NAME="$(aws_name s3-csv-created)"
ENGINE_FUNCTION="$(aws_name ramis-engine)"
ENGINE_ROLE="${ENGINE_FUNCTION}-role"
ENGINE_API_NAME="$ENGINE_FUNCTION"
LANDING_FUNCTION="$(aws_name landing-service)"
LANDING_ROLE="${LANDING_FUNCTION}-role"
LANDING_API_NAME="$LANDING_FUNCTION"
TRANSFER_ROLE="$(aws_name transfer)"

require_aws() {
  if ! command -v aws >/dev/null 2>&1; then
    echo "aws CLI is required" >&2
    exit 1
  fi
  ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
  QUEUE_ARN="arn:aws:sqs:${REGION}:${ACCOUNT_ID}:${QUEUE_NAME}"
  DLQ_ARN="arn:aws:sqs:${REGION}:${ACCOUNT_ID}:${DLQ_NAME}"
  RULE_ARN="arn:aws:events:${REGION}:${ACCOUNT_ID}:rule/${RULE_NAME}"
}

queue_url() {
  aws sqs get-queue-url --queue-name "$1" --region "$REGION" --query QueueUrl --output text
}

# Publish every non-empty variable from a package .env. Required names must be present.
write_lambda_environment() {
  local env_path="$1"
  local out_path="$2"
  shift 2
  if [[ ! -f "$env_path" ]]; then
    echo "missing $env_path" >&2
    echo "copy the env.example in that directory to .env" >&2
    exit 1
  fi
  ENV_PATH="$env_path" ENV_FILE="$out_path" REQUIRED="$*" python3 - <<'PY'
import json, os
from pathlib import Path

def parse(text):
    values = {}
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        if line.startswith("export "):
            line = line[len("export "):].strip()
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
            value = value[1:-1]
        if key:
            values[key] = value
    return values

path = Path(os.environ["ENV_PATH"])
values = parse(path.read_text())
missing = [name for name in os.environ["REQUIRED"].split() if not values.get(name, "").strip()]
if missing:
    raise SystemExit(f"{path} is missing {', '.join(missing)}")
variables = {key: value for key, value in values.items() if value != ""}
Path(os.environ["ENV_FILE"]).write_text(json.dumps({"Variables": variables}))
print(f"lambda environment from {path}: {' '.join(sorted(variables))}")
PY
}

# A new role is not assumable, and its inline policy is not visible, for several seconds.
retry_iam() {
  local attempt output
  for attempt in 1 2 3 4 5 6 7 8 9 10 11 12; do
    if output=$("$@" 2>&1); then
      return 0
    fi
    sleep 5
  done
  printf '%s\n' "$output" >&2
  echo "timed out waiting for IAM to accept the Lambda role" >&2
  return 1
}
