#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"
require_aws

if [[ -z "${SUPABASE_URL:-}${NEXT_PUBLIC_SUPABASE_URL:-}" || -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required." >&2
  exit 1
fi

FUNCTION_NAME="${LANDING_FUNCTION_NAME:-landing-service}"
ROLE_NAME="${FUNCTION_NAME}-role"
API_NAME="${LANDING_API_NAME:-landing-service}"
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

mkdir -p "$BUILD_DIR"

if ! aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  cat >"$BUILD_DIR/landing-trust.json" <<'EOF'
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
    --assume-role-policy-document "file://$BUILD_DIR/landing-trust.json" \
    >/dev/null
  echo "created iam role $ROLE_NAME"
fi

aws iam attach-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

echo "bundling @invoz/landing-service"
(
  cd "$REPO_ROOT"
  npx esbuild packages/landing-service/src/lambda.ts \
    --bundle \
    --platform=node \
    --target=node20 \
    --format=cjs \
    --outfile="$BUILD_DIR/landing-service.js"
)
(
  cd "$BUILD_DIR"
  rm -f landing-service.zip
  zip -q landing-service.zip landing-service.js
)

ENV_FILE="$BUILD_DIR/landing-service-env.json"
ENV_FILE="$ENV_FILE" python3 - <<'PY'
import json, os
variables = {
    "SUPABASE_URL": os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL", ""),
    "SUPABASE_SERVICE_ROLE_KEY": os.environ["SUPABASE_SERVICE_ROLE_KEY"],
}
for name in ("SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "DEMO_FROM_EMAIL", "LANDING_ALLOWED_ORIGINS"):
    value = os.environ.get(name, "").strip()
    if value:
        variables[name] = value
with open(os.environ["ENV_FILE"], "w") as handle:
    json.dump({"Variables": variables}, handle)
PY

if aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" >/dev/null 2>&1; then
  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --region "$REGION" \
    --zip-file "fileb://$BUILD_DIR/landing-service.zip" \
    >/dev/null
  aws lambda wait function-updated --function-name "$FUNCTION_NAME" --region "$REGION"
  aws lambda update-function-configuration \
    --function-name "$FUNCTION_NAME" \
    --region "$REGION" \
    --handler landing-service.handler \
    --timeout 20 \
    --memory-size 256 \
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
      --handler landing-service.handler \
      --role "$ROLE_ARN" \
      --timeout 20 \
      --memory-size 256 \
      --zip-file "fileb://$BUILD_DIR/landing-service.zip" \
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

aws lambda wait function-updated --function-name "$FUNCTION_NAME" --region "$REGION"
FUNCTION_ARN=$(aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" --query 'Configuration.FunctionArn' --output text)

API_ID=$(aws apigatewayv2 get-apis --region "$REGION" --query "Items[?Name=='$API_NAME'].ApiId | [0]" --output text)
if [[ -z "$API_ID" || "$API_ID" == "None" ]]; then
  API_ID=$(aws apigatewayv2 create-api \
    --name "$API_NAME" \
    --protocol-type HTTP \
    --region "$REGION" \
    --query ApiId \
    --output text)
  echo "created http api $API_NAME"
fi

INTEGRATION_ID=$(aws apigatewayv2 get-integrations --api-id "$API_ID" --region "$REGION" --query "Items[?IntegrationUri=='$FUNCTION_ARN'].IntegrationId | [0]" --output text)
if [[ -z "$INTEGRATION_ID" || "$INTEGRATION_ID" == "None" ]]; then
  INTEGRATION_ID=$(aws apigatewayv2 create-integration \
    --api-id "$API_ID" \
    --region "$REGION" \
    --integration-type AWS_PROXY \
    --integration-uri "$FUNCTION_ARN" \
    --payload-format-version 2.0 \
    --query IntegrationId \
    --output text)
fi

for ROUTE_KEY in 'ANY /' 'ANY /{proxy+}'; do
  EXISTING=$(aws apigatewayv2 get-routes --api-id "$API_ID" --region "$REGION" --query "Items[?RouteKey=='$ROUTE_KEY'].RouteId | [0]" --output text)
  if [[ -z "$EXISTING" || "$EXISTING" == "None" ]]; then
    aws apigatewayv2 create-route \
      --api-id "$API_ID" \
      --region "$REGION" \
      --route-key "$ROUTE_KEY" \
      --target "integrations/$INTEGRATION_ID" \
      >/dev/null
  fi
done

STAGE=$(aws apigatewayv2 get-stage --api-id "$API_ID" --stage-name '$default' --region "$REGION" --query StageName --output text 2>/dev/null || true)
if [[ "$STAGE" != '$default' ]]; then
  aws apigatewayv2 create-stage \
    --api-id "$API_ID" \
    --stage-name '$default' \
    --auto-deploy \
    --region "$REGION" \
    >/dev/null
fi

aws lambda add-permission \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION" \
  --statement-id "apigateway-${API_ID}" \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*" \
  >/dev/null 2>&1 || true

ENDPOINT=$(aws apigatewayv2 get-api --api-id "$API_ID" --region "$REGION" --query ApiEndpoint --output text)
echo "landing-service api: ${ENDPOINT}"
echo "set NEXT_PUBLIC_LANDING_API_URL=${ENDPOINT} for the landing app"
