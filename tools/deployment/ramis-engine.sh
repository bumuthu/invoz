#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"
require_aws

API_NAME="$ENGINE_API_NAME"
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ENGINE_ROLE}"

mkdir -p "$BUILD_DIR"

if ! aws iam get-role --role-name "$ENGINE_ROLE" >/dev/null 2>&1; then
  cat >"$BUILD_DIR/ramis-trust.json" <<'EOF'
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
    --role-name "$ENGINE_ROLE" \
    --assume-role-policy-document "file://$BUILD_DIR/ramis-trust.json" \
    >/dev/null
  echo "created iam role $ENGINE_ROLE"
fi

aws iam attach-role-policy \
  --role-name "$ENGINE_ROLE" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

echo "bundling @invoz/engine"
(
  cd "$REPO_ROOT"
  npx esbuild tools/ramis-engine/src/lambda.ts \
    --bundle \
    --platform=node \
    --target=node22 \
    --format=cjs \
    --outfile="$BUILD_DIR/ramis-engine.js"
)
cp "$REPO_ROOT/tools/ramis-engine/openapi.yaml" "$BUILD_DIR/openapi.yaml"
(
  cd "$BUILD_DIR"
  rm -f ramis-engine.zip
  zip -q ramis-engine.zip ramis-engine.js openapi.yaml
)

ENV_FILE="$BUILD_DIR/ramis-engine-env.json"
write_lambda_environment "$REPO_ROOT/tools/ramis-engine/.env" "$ENV_FILE" \
  RAMIS_DATABASE_URL RAMIS_MOCK_CLIENT_SECRET

if aws lambda get-function --function-name "$ENGINE_FUNCTION" --region "$REGION" >/dev/null 2>&1; then
  aws lambda update-function-code \
    --function-name "$ENGINE_FUNCTION" \
    --region "$REGION" \
    --zip-file "fileb://$BUILD_DIR/ramis-engine.zip" \
    >/dev/null
  aws lambda wait function-updated --function-name "$ENGINE_FUNCTION" --region "$REGION"
  aws lambda update-function-configuration \
    --function-name "$ENGINE_FUNCTION" \
    --region "$REGION" \
    --runtime nodejs22.x \
    --handler ramis-engine.handler \
    --timeout 30 \
    --memory-size 512 \
    --environment "file://$ENV_FILE" \
    >/dev/null
  echo "updated lambda $ENGINE_FUNCTION"
else
  retry_iam aws lambda create-function \
    --function-name "$ENGINE_FUNCTION" \
    --region "$REGION" \
    --runtime nodejs22.x \
    --handler ramis-engine.handler \
    --role "$ROLE_ARN" \
    --timeout 30 \
    --memory-size 512 \
    --zip-file "fileb://$BUILD_DIR/ramis-engine.zip" \
    --environment "file://$ENV_FILE"
  echo "created lambda $ENGINE_FUNCTION"
fi

aws lambda wait function-updated --function-name "$ENGINE_FUNCTION" --region "$REGION"
FUNCTION_ARN=$(aws lambda get-function --function-name "$ENGINE_FUNCTION" --region "$REGION" --query 'Configuration.FunctionArn' --output text)

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
  --function-name "$ENGINE_FUNCTION" \
  --region "$REGION" \
  --statement-id "apigateway-${API_ID}" \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*" \
  >/dev/null 2>&1 || true

ENDPOINT=$(aws apigatewayv2 get-api --api-id "$API_ID" --region "$REGION" --query ApiEndpoint --output text)
echo "ramis-engine api: ${ENDPOINT}"
echo "set RAMIS_API_URL=${ENDPOINT} in packages/invoice-engine/.env"
