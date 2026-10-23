# Provision the AWS pipeline

Run these from the repo root, in order. The default region is `ap-south-1`.

S3, SQS, the `invoice-engine` Lambda, EventBridge, and the two HTTP APIs come from `tools/deployment`. SFTP does not. Transfer Family is created with the AWS CLI after the bucket exists. `invoice-engine` has no API Gateway. SQS invokes it. API Gateway sits in front of `ramis-engine` and `landing-service` only.

Function names are not in `.env`. Each script uses its own default when the override variable is unset:

| Command | Default function | Override variable |
| --- | --- | --- |
| `npm run provision` and `npm run provision:lambda` | `invoice-engine` | `INVOICE_FUNCTION_NAME` |
| `npm run provision:ramis` | `ramis-engine` | `RAMIS_ENGINE_FUNCTION_NAME` |
| `npm run provision:landing` | `landing-service` | `LANDING_FUNCTION_NAME` |

The HTTP API names match those function names (`RAMIS_ENGINE_API_NAME`, `LANDING_API_NAME`).

`npm run provision` runs S3, SQS, Lambda, and EventBridge in one shot. Use the steps below when you want to create one resource at a time. EventBridge has no script of its own. The full `npm run provision` command is what attaches it, and that command is safe to repeat.

## Before you start

Install the AWS CLI, Node.js, `zip`, and `python3`. The machine's AWS credentials need permission to create S3 buckets, SQS queues, EventBridge rules, IAM roles, Lambda functions, and HTTP APIs (`apigatewayv2`). The SFTP step also needs `transfer:*` on that account.

```bash
aws sts get-caller-identity
npm install
```

Copy the env file and fill in the values:

```bash
cp tools/deployment/env.example tools/deployment/.env
```

| Variable | Required for | Purpose |
| --- | --- | --- |
| `AWS_REGION` | Every step | Defaults to `ap-south-1` when unset. |
| `ORGANIZATION_ID` | S3, per organization | Organization uuid. Not stored in `.env`. The bucket name is `{organization id}-invoice-bucket`. |
| `SUPABASE_URL` | `invoice-engine`, landing API | Portal database API URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | `invoice-engine`, landing API | Service role key for that project. |
| `RAMIS_DATABASE_URL` | RAMIS API | Engine database URL. Separate from the portal database. |
| `RAMIS_MOCK_CLIENT_SECRET` | RAMIS API | Client secret the engine checks. |
| `RAMIS_API_URL` | `invoice-engine` | Base URL of the RAMIS HTTP API. Leave empty until step 6. No path. |

The shell scripts do not read `.env` on their own. Load it into the shell:

```bash
set -a
source tools/deployment/.env
set +a
export AWS_REGION="${AWS_REGION:-ap-south-1}"
export ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
```

Keep that shell open for the steps below.

## 1. S3

Create one bucket per organization. The name is `{organization uuid}-invoice-bucket`. Repeat this command for each organization. The bucket blocks public access, encrypts objects with SSE-S3, turns on versioning, and allows S3 to send object-created events to EventBridge.

This command does not create the EventBridge rule. `aws events describe-rule --name ramis-s3-csv-created` fails with `ResourceNotFoundException` until step 5.

`ORGANIZATION_ID` must be the uuid from `organizations.id`.

```bash
ORGANIZATION_ID="<organization-uuid>" npm run provision:s3 -w @invoz/deployment
```

Check:

```bash
BUCKET="${ORGANIZATION_ID}-invoice-bucket"
aws s3api head-bucket --bucket "$BUCKET" --region "$AWS_REGION"
aws s3api get-bucket-notification-configuration --bucket "$BUCKET" --region "$AWS_REGION"
```

The notification configuration should contain `EventBridgeConfiguration`.

Upload path the pipeline accepts:

```text
s3://{organization_id}-invoice-bucket/uploads/{organization_id}/{legal_entity_id}/inbound/{file}.csv
```

Keys ending in `.csv.tmp` do not match the EventBridge rule. The rule matches every bucket whose name ends with `-invoice-bucket`, so a new organization does not need a new rule.

## 2. SFTP

There is no Transfer Family script in this repo. Create one public SFTP server. Add one user per organization, rooted in that organization's bucket. The server is billed for every hour it exists, plus the data uploaded. Set `ORGANIZATION_ID` to the same uuid used in step 1, then:

```bash
BUCKET="${ORGANIZATION_ID}-invoice-bucket"
```

Create a role Transfer Family can assume. `create-role` and `create-server` fail if that role or server already exists. The npm steps above can be repeated.

```bash
cat > /tmp/transfer-trust.json <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "transfer.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

aws iam create-role \
  --role-name ramis-transfer-role \
  --assume-role-policy-document file:///tmp/transfer-trust.json

cat > /tmp/transfer-s3.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket", "s3:GetBucketLocation"],
      "Resource": "arn:aws:s3:::*-invoice-bucket"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:GetObjectVersion"],
      "Resource": "arn:aws:s3:::*-invoice-bucket/*"
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name ramis-transfer-role \
  --policy-name ramis-transfer-s3 \
  --policy-document file:///tmp/transfer-s3.json
```

Create the server once. Create one ERP user per organization. Replace `erp-public-key.pub` with that organization's SSH public key. The session policy limits the user to `BUCKET`. An upload to `/uploads/{organization_id}/{legal_entity_id}/inbound/invoice_001.csv` becomes that same key in the organization bucket.

```bash
SERVER_ID=$(aws transfer create-server \
  --region "$AWS_REGION" \
  --identity-provider-type SERVICE_MANAGED \
  --protocols SFTP \
  --endpoint-type PUBLIC \
  --domain S3 \
  --query ServerId \
  --output text)

aws transfer describe-server \
  --region "$AWS_REGION" \
  --server-id "$SERVER_ID" \
  --query Server.State \
  --output text

cat > /tmp/transfer-session.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket", "s3:GetBucketLocation"],
      "Resource": "arn:aws:s3:::${BUCKET}"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:GetObjectVersion"],
      "Resource": "arn:aws:s3:::${BUCKET}/*"
    }
  ]
}
EOF

aws transfer create-user \
  --region "$AWS_REGION" \
  --server-id "$SERVER_ID" \
  --user-name "$ORGANIZATION_ID" \
  --role "arn:aws:iam::${ACCOUNT_ID}:role/ramis-transfer-role" \
  --home-directory "/${BUCKET}" \
  --policy file:///tmp/transfer-session.json \
  --ssh-public-key-body "$(cat erp-public-key.pub)"
```

Wait until the server state is `ONLINE`, then connect:

```bash
sftp -i erp-private-key "${ORGANIZATION_ID}@${SERVER_ID}.server.transfer.${AWS_REGION}.amazonaws.com"
```

## 3. SQS

Creates two FIFO queues:

| Queue | Role |
| --- | --- |
| `invoicing-pipeline.fifo` | Work queue. Visibility timeout 300 seconds. Content-based deduplication. |
| `invoicing-pipeline-dlq.fifo` | Dead-letter queue after 3 receives. |

The work queue allows EventBridge rule `ramis-s3-csv-created` to send messages. The rule itself is created in step 5.

```bash
npm run provision:sqs -w @invoz/deployment
```

Check:

```bash
aws sqs get-queue-url --queue-name invoicing-pipeline.fifo --region "$AWS_REGION"
aws sqs get-queue-url --queue-name invoicing-pipeline-dlq.fifo --region "$AWS_REGION"
```

## 4. Lambda

Publishes `invoice-engine` (Node.js 20, 512 MB, 60 second timeout) and maps `invoicing-pipeline.fifo` to it with batch size 5. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` must already be exported. The queue from step 3 must exist.

```bash
npm run provision:lambda -w @invoz/deployment
```

Check:

```bash
aws lambda get-function-configuration \
  --function-name invoice-engine \
  --region "$AWS_REGION" \
  --query '{State:State,Timeout:Timeout,Memory:MemorySize}'

aws lambda list-event-source-mappings \
  --function-name invoice-engine \
  --region "$AWS_REGION" \
  --query 'EventSourceMappings[].{Queue:EventSourceArn,Batch:BatchSize,State:State}'
```

The role can read and write the bucket, consume the work queue, and read Secrets Manager secrets named `ramis/*`. This step does not create a secret.

Leave `RAMIS_API_URL` empty on this first run. The worker does not receive the variable while it is empty. Step 6 prints the URL. Write that URL into `.env` and run this command again.

## 5. EventBridge

This is the step that creates rule `ramis-s3-csv-created` on the default event bus. There is no `provision:eventbridge` script. `npm run provision` creates the SQS queues and the `invoice-engine` Lambda if they are missing, then adds the rule. Run it even when the organization bucket from step 1 already exists. Without `ORGANIZATION_ID`, it skips bucket creation.

The rule matches `Object Created` for keys `uploads/*.csv` on every bucket whose name ends with `-invoice-bucket`. The FIFO message group id is the object key. The queue receives:

```json
{"source":"s3","bucket":"<bucket>","objectKey":"<key>"}
```

From the repo root, with `.env` loaded:

```bash
set -a
source tools/deployment/.env
set +a
npm run provision
```

From `tools/deployment`, the env file is in the current directory. `source tools/deployment/.env` fails there.

```bash
set -a
source .env
set +a
npm run provision
```

Check:

```bash
aws events describe-rule \
  --name ramis-s3-csv-created \
  --region "$AWS_REGION" \
  --query '{State:State,Pattern:EventPattern}'

aws events list-targets-by-rule \
  --rule ramis-s3-csv-created \
  --region "$AWS_REGION"
```

The target ARN should be `invoicing-pipeline.fifo`.

## Smoke test

Put a CSV directly in the bucket. This exercises S3, EventBridge, SQS, and Lambda without SFTP.

```bash
BUCKET="${ORGANIZATION_ID}-invoice-bucket"
echo "sample" > /tmp/invoice_001.csv
aws s3 cp /tmp/invoice_001.csv \
  "s3://${BUCKET}/uploads/${ORGANIZATION_ID}/entity-id/inbound/invoice_001.csv" \
  --region "$AWS_REGION"
```

Then read the queue, or the Lambda log group `/aws/lambda/invoice-engine`, and confirm the object key arrived.

## 6. API Gateway

Two HTTP APIs, each forwarding `ANY /` and `ANY /{proxy+}` to one Lambda with payload format 2.0. Neither API adds auth, throttling, or a custom domain. CORS for the landing site is handled inside `landing-service`.

| API name | Lambda | Timeout | Memory | Caller |
| --- | --- | --- | --- | --- |
| `ramis-engine` | `ramis-engine` | 30 s | 512 MB | `invoice-engine`, through `RAMIS_API_URL` |
| `landing-service` | `landing-service` | 20 s | 256 MB | `landing-app`, through `NEXT_PUBLIC_LANDING_API_URL` |

`RAMIS_DATABASE_URL` must be exported before the RAMIS API. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` must be exported before the landing API. Optional SMTP variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `DEMO_FROM_EMAIL`) are copied onto `landing-service` when they are set. See `packages/landing-service/.env.example`.

```bash
npm run provision:ramis
npm run provision:landing
```

`npm run provision:ramis` prints the value for `RAMIS_API_URL`. It is the API base URL, with no path:

```text
https://{api-id}.execute-api.{region}.amazonaws.com
```

The region in that host is `AWS_REGION` from `.env`. Paste the printed URL into `RAMIS_API_URL`, load `.env` again, and publish the worker:

```bash
set -a
source tools/deployment/.env
set +a
npm run provision:lambda -w @invoz/deployment
```

`npm run provision:landing` prints a URL of the same shape. Set that as `NEXT_PUBLIC_LANDING_API_URL` on `landing-app`. It does not belong in `tools/deployment/.env`.

Check both APIs:

```bash
aws apigatewayv2 get-apis \
  --region "$AWS_REGION" \
  --query "Items[?Name=='ramis-engine' || Name=='landing-service'].{Name:Name,Endpoint:ApiEndpoint,Protocol:ProtocolType}"
```

Health checks:

```bash
curl "$RAMIS_API_URL/health"
curl "${NEXT_PUBLIC_LANDING_API_URL}/health"
```

Landing `GET /health` returns `{ "ok": true }`. RAMIS `GET /health` returns `{ "status": "ok", "service": "ramis-mock" }` plus the ledger counts.
