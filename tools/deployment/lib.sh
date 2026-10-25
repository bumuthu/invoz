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
