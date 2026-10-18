#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"
require_aws

mkdir -p "$BUILD_DIR"

aws sqs create-queue \
  --queue-name "$DLQ_NAME" \
  --region "$REGION" \
  --attributes FifoQueue=true,ContentBasedDeduplication=true,DeduplicationScope=messageGroup,FifoThroughputLimit=perMessageGroupId \
  >/dev/null
echo "sqs queue $DLQ_NAME"

cat >"$BUILD_DIR/queue-attributes.json" <<EOF
{
  "FifoQueue": "true",
  "ContentBasedDeduplication": "true",
  "VisibilityTimeout": "300",
  "DeduplicationScope": "messageGroup",
  "FifoThroughputLimit": "perMessageGroupId",
  "RedrivePolicy": "{\"deadLetterTargetArn\":\"$DLQ_ARN\",\"maxReceiveCount\":\"3\"}"
}
EOF

aws sqs create-queue \
  --queue-name "$QUEUE_NAME" \
  --region "$REGION" \
  --attributes "file://$BUILD_DIR/queue-attributes.json" \
  >/dev/null

QUEUE_URL=$(queue_url "$QUEUE_NAME")
cat >"$BUILD_DIR/queue-settings.json" <<EOF
{
  "VisibilityTimeout": "300",
  "RedrivePolicy": "{\"deadLetterTargetArn\":\"$DLQ_ARN\",\"maxReceiveCount\":\"3\"}"
}
EOF
aws sqs set-queue-attributes \
  --queue-url "$QUEUE_URL" \
  --region "$REGION" \
  --attributes "file://$BUILD_DIR/queue-settings.json"

cat >"$BUILD_DIR/queue-policy.json" <<EOF
{
  "Policy": "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Sid\":\"AllowEventBridge\",\"Effect\":\"Allow\",\"Principal\":{\"Service\":\"events.amazonaws.com\"},\"Action\":\"sqs:SendMessage\",\"Resource\":\"$QUEUE_ARN\",\"Condition\":{\"ArnEquals\":{\"aws:SourceArn\":\"$RULE_ARN\"}}}]}"
}
EOF

aws sqs set-queue-attributes \
  --queue-url "$QUEUE_URL" \
  --region "$REGION" \
  --attributes "file://$BUILD_DIR/queue-policy.json"

echo "sqs queue $QUEUE_NAME visibility 300s, 3 receives, then $DLQ_NAME"
echo "MessageGroupId for a branch is {legalEntityId}:{branchCode}"
