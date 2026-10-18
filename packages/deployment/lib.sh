#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "$DEPLOY_DIR/../.." && pwd)
BUILD_DIR="$DEPLOY_DIR/.build"

REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-ap-southeast-1}}"
export AWS_REGION="$REGION"
export AWS_DEFAULT_REGION="$REGION"

QUEUE_NAME="invoicing-pipeline.fifo"
DLQ_NAME="invoicing-pipeline-dlq.fifo"
FUNCTION_NAME="${RAMIS_FUNCTION_NAME:-invoice-engine}"
ROLE_NAME="${FUNCTION_NAME}-role"
RULE_NAME="ramis-s3-csv-created"

require_aws() {
  if ! command -v aws >/dev/null 2>&1; then
    echo "aws CLI is required" >&2
    exit 1
  fi
  ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
  BUCKET="${RAMIS_BUCKET:-ramis-einvoice-${ACCOUNT_ID}}"
  QUEUE_ARN="arn:aws:sqs:${REGION}:${ACCOUNT_ID}:${QUEUE_NAME}"
  DLQ_ARN="arn:aws:sqs:${REGION}:${ACCOUNT_ID}:${DLQ_NAME}"
  RULE_ARN="arn:aws:events:${REGION}:${ACCOUNT_ID}:rule/${RULE_NAME}"
}

queue_url() {
  aws sqs get-queue-url --queue-name "$1" --region "$REGION" --query QueueUrl --output text
}
