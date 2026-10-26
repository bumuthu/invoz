#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"
require_aws

FUNCTION_NAME="$LANDING_FUNCTION"
ROLE_NAME="$LANDING_ROLE"
API_NAME="$LANDING_API_NAME"
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
    --target=node22 \
    --format=cjs \
    --external:@prisma/client \
    --external:.prisma/client \
    --outfile="$BUILD_DIR/landing-service.js"
  pack_prisma "$BUILD_DIR"
)
(
  cd "$BUILD_DIR"
  rm -f landing-service.zip
  zip -qr landing-service.zip landing-service.js node_modules
)

ENV_FILE="$BUILD_DIR/landing-service-env.json"
write_lambda_environment "$REPO_ROOT/packages/landing-service/.env" "$ENV_FILE" \
  DATABASE_URL

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
    --runtime nodejs22.x \
    --handler landing-service.handler \
    --timeout 20 \
    --memory-size 256 \
    --environment "file://$ENV_FILE" \
    >/dev/null
  echo "updated lambda $FUNCTION_NAME"
else
  retry_iam aws lambda create-function \
    --function-name "$FUNCTION_NAME" \
    --region "$REGION" \
    --runtime nodejs22.x \
    --handler landing-service.handler \
    --role "$ROLE_ARN" \
    --timeout 20 \
    --memory-size 256 \
    --zip-file "fileb://$BUILD_DIR/landing-service.zip" \
    --environment "file://$ENV_FILE"
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
