#!/usr/bin/env bash
# One-minute EventBridge rule for invoz-{env}-erp-poll-s4hana.
# The function must already exist. Run erp-poll-lambda.sh first.
set -euo pipefail
source "$(dirname "$0")/lib.sh"
require_aws

if ! aws lambda get-function --function-name "$ERP_POLL_SAP_FUNCTION" --region "$REGION" >/dev/null 2>&1; then
  echo "create $ERP_POLL_SAP_FUNCTION before the schedule. Run erp-poll-lambda.sh first." >&2
  exit 1
fi

mkdir -p "$BUILD_DIR/erp-poll"
POLL_BUILD="$BUILD_DIR/erp-poll"
FUNCTION_ARN=$(aws lambda get-function \
  --function-name "$ERP_POLL_SAP_FUNCTION" \
  --region "$REGION" \
  --query 'Configuration.FunctionArn' \
  --output text)
RULE_ARN="arn:aws:events:${REGION}:${ACCOUNT_ID}:rule/${ERP_POLL_SAP_RULE}"

aws events put-rule \
  --name "$ERP_POLL_SAP_RULE" \
  --region "$REGION" \
  --state ENABLED \
  --schedule-expression "rate(1 minute)" \
  >/dev/null
echo "rule $ERP_POLL_SAP_RULE rate(1 minute)"

PERMISSION_ERROR="$POLL_BUILD/permission-error.txt"
if ! aws lambda add-permission \
  --function-name "$ERP_POLL_SAP_FUNCTION" \
  --region "$REGION" \
  --statement-id erp-poll-s4hana \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn "$RULE_ARN" \
  >/dev/null 2>"$PERMISSION_ERROR"; then
  if grep -q ResourceConflictException "$PERMISSION_ERROR"; then
    echo "invoke permission already exists"
  else
    cat "$PERMISSION_ERROR" >&2
    exit 1
  fi
else
  echo "allowed $ERP_POLL_SAP_RULE to invoke $ERP_POLL_SAP_FUNCTION"
fi

cat >"$POLL_BUILD/targets.json" <<EOF
[
  {
    "Id": "s4hana",
    "Arn": "$FUNCTION_ARN"
  }
]
EOF

TARGETS=$(aws events put-targets \
  --rule "$ERP_POLL_SAP_RULE" \
  --region "$REGION" \
  --targets "file://$POLL_BUILD/targets.json" \
  --output json)
python3 -c 'import json,sys; failed=json.loads(sys.argv[1]).get("FailedEntryCount", 0); sys.exit(1 if failed else 0)' "$TARGETS"
echo "target $FUNCTION_ARN"
