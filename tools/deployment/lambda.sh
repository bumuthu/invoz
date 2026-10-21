#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"
require_aws

if [[ -z "${SUPABASE_URL:-}" || -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required" >&2
  exit 1
fi

if ! aws sqs get-queue-url --queue-name "$QUEUE_NAME" --region "$REGION" >/dev/null 2>&1; then
  echo "create $QUEUE_NAME before the Lambda. Run sqs.sh first." >&2
  exit 1
fi

mkdir -p "$BUILD_DIR"
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

if ! aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  cat >"$BUILD_DIR/trust.json" <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "lambda.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF
  aws iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document "file://$BUILD_DIR/trust.json" \
    >/dev/null
  echo "created iam role $ROLE_NAME"
fi

aws iam attach-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

cat >"$BUILD_DIR/permissions.json" <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes",
        "sqs:ChangeMessageVisibility"
      ],
      "Resource": "$QUEUE_ARN"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::$BUCKET/*"
    },
    {
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::$BUCKET"
    },
    {
      "Effect": "Allow",
      "Action": "secretsmanager:GetSecretValue",
      "Resource": "arn:aws:secretsmanager:$REGION:$ACCOUNT_ID:secret:ramis/*"
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name "${FUNCTION_NAME}-pipeline" \
  --policy-document "file://$BUILD_DIR/permissions.json"

echo "bundling @invoz/invoice-engine"
(
  cd "$REPO_ROOT"
  npx esbuild packages/invoice-engine/src/index.ts \
    --bundle \
    --platform=node \
    --target=node20 \
    --format=cjs \
    --outfile="$BUILD_DIR/index.js"
)
(
  cd "$BUILD_DIR"
  rm -f function.zip
  zip -q function.zip index.js
)

ENV_FILE="$BUILD_DIR/lambda-env.json"
ENV_FILE="$ENV_FILE" python3 - <<'PY'
import json, os
variables = {
    "SUPABASE_URL": os.environ["SUPABASE_URL"],
    "SUPABASE_SERVICE_ROLE_KEY": os.environ["SUPABASE_SERVICE_ROLE_KEY"],
}
api = os.environ.get("RAMIS_API_URL", "").strip()
if api:
    variables["RAMIS_API_URL"] = api
with open(os.environ["ENV_FILE"], "w") as handle:
    json.dump({"Variables": variables}, handle)
PY

if aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" >/dev/null 2>&1; then
  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --region "$REGION" \
    --zip-file "fileb://$BUILD_DIR/function.zip" \
    >/dev/null
  aws lambda wait function-updated --function-name "$FUNCTION_NAME" --region "$REGION"
  aws lambda update-function-configuration \
    --function-name "$FUNCTION_NAME" \
    --region "$REGION" \
    --timeout 60 \
    --memory-size 512 \
    --environment "file://$ENV_FILE" \
    >/dev/null
  echo "updated lambda $FUNCTION_NAME"
else
  created=0
  for _ in 1 2 3 4 5 6; do
    if aws lambda create-function \
      --function-name "$FUNCTION_NAME" \
      --region "$REGION" \
      --runtime nodejs20.x \
      --handler index.handler \
      --role "$ROLE_ARN" \
      --timeout 60 \
      --memory-size 512 \
      --zip-file "fileb://$BUILD_DIR/function.zip" \
      --environment "file://$ENV_FILE" \
      >/dev/null
    then
      created=1
      break
    fi
    sleep 5
  done
  if [[ "$created" -ne 1 ]]; then
    echo "lambda role was not ready in time" >&2
    exit 1
  fi
  echo "created lambda $FUNCTION_NAME"
fi

MAPPING=$(aws lambda list-event-source-mappings \
  --function-name "$FUNCTION_NAME" \
  --event-source-arn "$QUEUE_ARN" \
  --region "$REGION" \
  --query 'EventSourceMappings[0].UUID' \
  --output text)

if [[ -z "$MAPPING" || "$MAPPING" == "None" ]]; then
  aws lambda create-event-source-mapping \
    --function-name "$FUNCTION_NAME" \
    --event-source-arn "$QUEUE_ARN" \
    --region "$REGION" \
    --batch-size 5 \
    --function-response-types ReportBatchItemFailures \
    >/dev/null
  echo "mapped $QUEUE_NAME to $FUNCTION_NAME"
else
  aws lambda update-event-source-mapping \
    --uuid "$MAPPING" \
    --region "$REGION" \
    --batch-size 5 \
    --function-response-types ReportBatchItemFailures \
    >/dev/null
  echo "updated event source mapping $MAPPING"
fi
