#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"
require_aws

mkdir -p "$BUILD_DIR"
BUCKET="$INVOICE_BUCKET"

if aws s3api head-bucket --bucket "$BUCKET" >/dev/null 2>&1; then
  echo "s3 bucket $BUCKET already exists"
else
  if [[ "$REGION" == "us-east-1" ]]; then
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION"
  else
    aws s3api create-bucket \
      --bucket "$BUCKET" \
      --region "$REGION" \
      --create-bucket-configuration "LocationConstraint=$REGION"
  fi
  echo "created s3 bucket $BUCKET"
fi

aws s3api put-public-access-block \
  --bucket "$BUCKET" \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

aws s3api put-bucket-encryption \
  --bucket "$BUCKET" \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

aws s3api put-bucket-versioning \
  --bucket "$BUCKET" \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-notification-configuration \
  --bucket "$BUCKET" \
  --notification-configuration '{"EventBridgeConfiguration":{}}'

echo "s3://$BUCKET sends object-created events to EventBridge"
echo "organization prefix: uploads/{organization_id}/{legal_entity_id}/{branch_id}/inbound/*.csv"
