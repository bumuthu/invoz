#!/usr/bin/env bash
# Publishes invoz-{env}-erp-poll-s4hana. EventBridge is a separate script.
set -euo pipefail
source "$(dirname "$0")/lib.sh"
require_aws

mkdir -p "$BUILD_DIR/erp-poll"
POLL_BUILD="$BUILD_DIR/erp-poll"
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ERP_POLL_ROLE}"

if ! aws iam get-role --role-name "$ERP_POLL_ROLE" >/dev/null 2>&1; then
  cat >"$POLL_BUILD/trust.json" <<'EOF'
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
    --role-name "$ERP_POLL_ROLE" \
    --assume-role-policy-document "file://$POLL_BUILD/trust.json" \
    >/dev/null
  echo "created iam role $ERP_POLL_ROLE"
fi

aws iam attach-role-policy \
  --role-name "$ERP_POLL_ROLE" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

cat >"$POLL_BUILD/permissions.json" <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject"],
      "Resource": "arn:aws:s3:::${INVOICE_BUCKET}/*"
    },
    {
      "Effect": "Allow",
      "Action": "secretsmanager:GetSecretValue",
      "Resource": "arn:aws:secretsmanager:$REGION:$ACCOUNT_ID:secret:invoz-${APP_ENV}/*"
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name "$ERP_POLL_ROLE" \
  --policy-name "$(aws_name erp-poll)-pipeline" \
  --policy-document "file://$POLL_BUILD/permissions.json"

echo "bundling @invoz/erp-poll"
(
  cd "$REPO_ROOT"
  npx esbuild packages/erp-poll/src/s4hana.ts \
    --bundle \
    --platform=node \
    --target=node22 \
    --format=cjs \
    --external:@prisma/client \
    --external:.prisma/client \
    --outfile="$POLL_BUILD/s4hana.js"
  pack_prisma "$POLL_BUILD"
)
(
  cd "$POLL_BUILD"
  rm -f function.zip
  zip -qr function.zip s4hana.js node_modules
)

ENV_FILE="$POLL_BUILD/lambda-env.json"
write_lambda_environment "$REPO_ROOT/packages/erp-poll/.env" "$ENV_FILE" \
  DATABASE_URL INVOICE_BUCKET
ENV_FILE="$ENV_FILE" APP_ENV="$APP_ENV" python3 - <<'PY'
import json, os
from pathlib import Path
path = Path(os.environ["ENV_FILE"])
data = json.loads(path.read_text())
data["Variables"]["APP_ENV"] = os.environ["APP_ENV"]
path.write_text(json.dumps(data))
PY

if aws lambda get-function --function-name "$ERP_POLL_SAP_FUNCTION" --region "$REGION" >/dev/null 2>&1; then
  aws lambda update-function-code \
    --function-name "$ERP_POLL_SAP_FUNCTION" \
    --region "$REGION" \
    --zip-file "fileb://$POLL_BUILD/function.zip" \
    >/dev/null
  aws lambda wait function-updated --function-name "$ERP_POLL_SAP_FUNCTION" --region "$REGION"
  aws lambda update-function-configuration \
    --function-name "$ERP_POLL_SAP_FUNCTION" \
    --region "$REGION" \
    --runtime nodejs22.x \
    --handler s4hana.handler \
    --timeout 90 \
    --memory-size 512 \
    --environment "file://$ENV_FILE" \
    >/dev/null
  echo "updated lambda $ERP_POLL_SAP_FUNCTION"
else
  retry_iam aws lambda create-function \
    --function-name "$ERP_POLL_SAP_FUNCTION" \
    --region "$REGION" \
    --runtime nodejs22.x \
    --handler s4hana.handler \
    --role "$ROLE_ARN" \
    --timeout 90 \
    --memory-size 512 \
    --zip-file "fileb://$POLL_BUILD/function.zip" \
    --environment "file://$ENV_FILE"
  echo "created lambda $ERP_POLL_SAP_FUNCTION"
fi
