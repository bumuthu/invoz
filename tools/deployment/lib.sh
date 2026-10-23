#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "$DEPLOY_DIR/../.." && pwd)
BUILD_DIR="$DEPLOY_DIR/.build"

REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-ap-south-1}}"
export AWS_REGION="$REGION"
export AWS_DEFAULT_REGION="$REGION"

QUEUE_NAME="invoicing-pipeline.fifo"
DLQ_NAME="invoicing-pipeline-dlq.fifo"
BUCKET_SUFFIX="-invoice-bucket"
FUNCTION_NAME="${INVOICE_FUNCTION_NAME:-${RAMIS_FUNCTION_NAME:-invoice-engine}}"
ROLE_NAME="${FUNCTION_NAME}-role"
RULE_NAME="ramis-s3-csv-created"

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

org_bucket() {
  local org
  org=$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')
  if [[ ! "$org" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]]; then
    echo "ORGANIZATION_ID must be a uuid" >&2
    return 1
  fi
  printf '%s%s\n' "$org" "$BUCKET_SUFFIX"
}
