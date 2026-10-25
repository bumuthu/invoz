#!/usr/bin/env bash
set -euo pipefail

DIR=$(cd "$(dirname "$0")" && pwd)
"$DIR/s3.sh"
"$DIR/sqs.sh"
"$DIR/lambda.sh"

source "$DIR/lib.sh"
require_aws
mkdir -p "$BUILD_DIR"

cat >"$BUILD_DIR/s3-rule.json" <<EOF
{
  "source": ["aws.s3"],
  "detail-type": ["Object Created"],
  "detail": {
    "bucket": { "name": ["${INVOICE_BUCKET}"] },
    "object": { "key": [{ "wildcard": "uploads/*.csv" }] }
  }
}
EOF

aws events put-rule \
  --name "$RULE_NAME" \
  --region "$REGION" \
  --state ENABLED \
  --event-pattern "file://$BUILD_DIR/s3-rule.json" \
  >/dev/null

cat >"$BUILD_DIR/s3-target.json" <<EOF
[
  {
    "Id": "invoz-${APP_ENV}-invoicing-pipeline",
    "Arn": "$QUEUE_ARN",
    "SqsParameters": {
      "MessageGroupId": "\$.detail.object.key"
    },
    "InputTransformer": {
      "InputPathsMap": {
        "bucket": "\$.detail.bucket.name",
        "key": "\$.detail.object.key"
      },
      "InputTemplate": "{\"source\":\"s3\",\"bucket\":\"<bucket>\",\"objectKey\":\"<key>\"}"
    }
  }
]
EOF

TARGETS=$(aws events put-targets \
  --rule "$RULE_NAME" \
  --region "$REGION" \
  --targets "file://$BUILD_DIR/s3-target.json" \
  --output json)
python3 -c 'import json,sys; failed=json.loads(sys.argv[1]).get("FailedEntryCount", 0); sys.exit(1 if failed else 0)' "$TARGETS"

echo "provisioned s3://$INVOICE_BUCKET, $QUEUE_NAME, $DLQ_NAME, and $FUNCTION_NAME in $REGION"
