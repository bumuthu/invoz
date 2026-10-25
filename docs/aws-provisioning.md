# Provision the AWS pipeline

Run these from the repo root, in order. The default region is `ap-south-1`.

S3, SQS, the invoice-engine Lambda, EventBridge, and the two HTTP APIs come from `tools/deployment`. SFTP does not. Transfer Family is created with the AWS CLI after the bucket exists. The invoice-engine Lambda has no API Gateway. SQS invokes it. API Gateway sits in front of the RAMIS and landing Lambdas only.

`APP_ENV` is `stag` or `prod`. Every AWS name is `invoz-{APP_ENV}-{resource}`:

| Resource | Name |
| --- | --- |
| S3 bucket | `invoz-{env}-invoices` |
| SQS work queue | `invoz-{env}-invoicing-pipeline.fifo` |
| SQS dead-letter queue | `invoz-{env}-invoicing-pipeline-dlq.fifo` |
| EventBridge rule | `invoz-{env}-s3-csv-created` |
| Invoice Lambda and its role | `invoz-{env}-invoice-engine`, `invoz-{env}-invoice-engine-role` |
| RAMIS Lambda, role, and HTTP API | `invoz-{env}-ramis-engine`, `invoz-{env}-ramis-engine-role` |
| Landing Lambda, role, and HTTP API | `invoz-{env}-landing-service`, `invoz-{env}-landing-service-role` |
| Transfer Family role | `invoz-{env}-transfer` |

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
| `APP_ENV` | Every step | `stag` or `prod`. Prefixes every AWS name. |
| `ORGANIZATION_ID` | SFTP, per organization | Organization uuid from `organizations.id`. Not stored in `.env`. The SFTP user is chrooted to `uploads/{organization id}/` in `invoz-{env}-invoices`. |
| `SUPABASE_URL` | `invoice-engine`, landing API | Portal database API URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | `invoice-engine`, landing API | Service role key for that project. |
| `RAMIS_DATABASE_URL` | RAMIS API | Postgres URL. The engine uses schema `ramis_engine` only. |
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

Create one bucket named `invoz-{env}-invoices`. Each organization is the prefix `uploads/{organization uuid}/`. The bucket blocks public access, encrypts objects with SSE-S3, turns on versioning, and allows S3 to send object-created events to EventBridge.

This command does not create the EventBridge rule. `aws events describe-rule --name invoz-${APP_ENV}-s3-csv-created` fails with `ResourceNotFoundException` until step 5. A new organization does not need a new bucket or a new rule.

```bash
npm run provision:s3 -w @invoz/deployment
```

Check:

```bash
BUCKET="invoz-${APP_ENV}-invoices"
aws s3api head-bucket --bucket "$BUCKET" --region "$AWS_REGION"
aws s3api get-bucket-notification-configuration --bucket "$BUCKET" --region "$AWS_REGION"
```

The notification configuration should contain `EventBridgeConfiguration`.

Upload path the pipeline accepts:

```text
s3://invoz-${APP_ENV}-invoices/uploads/{organization_id}/{legal_entity_id}/inbound/{file}.csv
```

Keys ending in `.csv.tmp` do not match the EventBridge rule. The rule matches this bucket only.

## 2. SFTP

There is no Transfer Family script in this repo. Create one public SFTP server. Add one user per organization, chrooted to that organization's prefix in the shared bucket. The server is billed for every hour it exists, plus the data uploaded. `ORGANIZATION_ID` is the uuid from `organizations.id`.

```bash
BUCKET="invoz-${APP_ENV}-invoices"
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
  --role-name invoz-${APP_ENV}-transfer \
  --assume-role-policy-document file:///tmp/transfer-trust.json

cat > /tmp/transfer-s3.json <<EOF
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

aws iam put-role-policy \
  --role-name invoz-${APP_ENV}-transfer \
  --policy-name invoz-${APP_ENV}-transfer-s3 \
  --policy-document file:///tmp/transfer-s3.json
```

Create the server once. Create one ERP user per organization. Replace `erp-public-key.pub` with that organization's SSH public key. The home directory maps `/` to `uploads/{organization_id}/`, and the session policy limits the user to that prefix. An upload of `/{legal_entity_id}/inbound/invoice_001.csv` is stored as `uploads/{organization_id}/{legal_entity_id}/inbound/invoice_001.csv`.

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
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::${BUCKET}",
      "Condition": {
        "StringLike": {
          "s3:prefix": [
            "uploads/${ORGANIZATION_ID}",
            "uploads/${ORGANIZATION_ID}/*"
          ]
        }
      }
    },
    {
      "Effect": "Allow",
      "Action": "s3:GetBucketLocation",
      "Resource": "arn:aws:s3:::${BUCKET}"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:GetObjectVersion"],
      "Resource": "arn:aws:s3:::${BUCKET}/uploads/${ORGANIZATION_ID}/*"
    }
  ]
}
EOF

aws transfer create-user \
  --region "$AWS_REGION" \
  --server-id "$SERVER_ID" \
  --user-name "$ORGANIZATION_ID" \
  --role "arn:aws:iam::${ACCOUNT_ID}:role/invoz-${APP_ENV}-transfer" \
  --home-directory-type LOGICAL \
  --home-directory-mappings "[{\"Entry\":\"/\",\"Target\":\"/${BUCKET}/uploads/${ORGANIZATION_ID}\"}]" \
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
| `invoz-${APP_ENV}-invoicing-pipeline.fifo` | Work queue. Visibility timeout 300 seconds. Content-based deduplication. |
| `invoz-${APP_ENV}-invoicing-pipeline-dlq.fifo` | Dead-letter queue after 3 receives. |

The work queue allows EventBridge rule `invoz-${APP_ENV}-s3-csv-created` to send messages. The rule itself is created in step 5.

```bash
npm run provision:sqs -w @invoz/deployment
```

Check:

```bash
aws sqs get-queue-url --queue-name invoz-${APP_ENV}-invoicing-pipeline.fifo --region "$AWS_REGION"
aws sqs get-queue-url --queue-name invoz-${APP_ENV}-invoicing-pipeline-dlq.fifo --region "$AWS_REGION"
```

## 4. Lambda

Publishes `invoz-${APP_ENV}-invoice-engine` (Node.js 20, 512 MB, 60 second timeout) and maps `invoz-${APP_ENV}-invoicing-pipeline.fifo` to it with batch size 5. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` must already be exported. The queue from step 3 must exist.

```bash
npm run provision:lambda -w @invoz/deployment
```

Check:

```bash
aws lambda get-function-configuration \
  --function-name invoz-${APP_ENV}-invoice-engine \
  --region "$AWS_REGION" \
  --query '{State:State,Timeout:Timeout,Memory:MemorySize}'

aws lambda list-event-source-mappings \
  --function-name invoz-${APP_ENV}-invoice-engine \
  --region "$AWS_REGION" \
  --query 'EventSourceMappings[].{Queue:EventSourceArn,Batch:BatchSize,State:State}'
```

The role can read and write the shared invoice bucket, consume the work queue, and read Secrets Manager secrets named `invoz-${APP_ENV}/*`. This step does not create a secret.

Leave `RAMIS_API_URL` empty on this first run. The worker does not receive the variable while it is empty. Step 6 prints the URL. Write that URL into `.env` and run this command again.

## 5. EventBridge

This is the step that creates rule `invoz-${APP_ENV}-s3-csv-created` on the default event bus. There is no `provision:eventbridge` script. `npm run provision` creates the shared bucket, the SQS queues, and the `invoz-${APP_ENV}-invoice-engine` Lambda if they are missing, then adds the rule. Run it even when the bucket from step 1 already exists.

The rule matches `Object Created` for keys `uploads/*/inbound/*.csv` in the shared invoice bucket. A copy into `processed/`, `rejected/`, or `acknowledgments/` does not start another job. The FIFO message group id is the object key. The queue receives:

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
  --name invoz-${APP_ENV}-s3-csv-created \
  --region "$AWS_REGION" \
  --query '{State:State,Pattern:EventPattern}'

aws events list-targets-by-rule \
  --rule invoz-${APP_ENV}-s3-csv-created \
  --region "$AWS_REGION"
```

The target ARN should be `invoz-${APP_ENV}-invoicing-pipeline.fifo`.

## Upload invoices

Inbound CSVs for each environment live in `tools/invoice-uploader`:

```text
tools/invoice-uploader/invoices/{env}/{organization_id}/{legal_entity_id}/inbound/{file}.csv
```

`{env}` is `stag` or `prod`. The sync puts those files at the same keys an SFTP upload uses. A file is sent when the key is missing, or the local copy is newer or a different size. `.csv.tmp` files and any file outside `inbound/` are skipped.

```bash
npm run sync:invoices -- stag
```

With no argument, the script uses `APP_ENV`. `AWS_REGION` defaults to `ap-south-1`.

## Smoke test

Put a CSV directly in the bucket. This exercises S3, EventBridge, SQS, and Lambda without SFTP.

```bash
BUCKET="invoz-${APP_ENV}-invoices"
echo "sample" > /tmp/invoice_001.csv
aws s3 cp /tmp/invoice_001.csv \
  "s3://${BUCKET}/uploads/${ORGANIZATION_ID}/entity-id/inbound/invoice_001.csv" \
  --region "$AWS_REGION"
```

Then read the queue, or the Lambda log group `/aws/lambda/invoz-${APP_ENV}-invoice-engine`, and confirm the object key arrived.

## 6. API Gateway

Two HTTP APIs, each forwarding `ANY /` and `ANY /{proxy+}` to one Lambda with payload format 2.0. Neither API adds auth, throttling, or a custom domain. CORS for the landing site is handled inside `landing-service`.

| API name | Lambda | Timeout | Memory | Caller |
| --- | --- | --- | --- | --- |
| `invoz-{env}-ramis-engine` | `invoz-{env}-ramis-engine` | 30 s | 512 MB | `invoz-{env}-invoice-engine`, through `RAMIS_API_URL` |
| `invoz-{env}-landing-service` | `invoz-{env}-landing-service` | 20 s | 256 MB | `landing-app`, through `NEXT_PUBLIC_LANDING_API_URL` |

`RAMIS_DATABASE_URL` must be exported before the RAMIS API. The function sets `search_path` to `ramis_engine`. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` must be exported before the landing API. Demo email is off unless `LANDING_EMAIL_ENABLED` is `true`. SMTP variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `DEMO_FROM_EMAIL`) are copied when set and used only while that flag is on. See `packages/landing-service/.env.example`.

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
  --query "Items[?Name=='invoz-${APP_ENV}-ramis-engine' || Name=='invoz-${APP_ENV}-landing-service'].{Name:Name,Endpoint:ApiEndpoint,Protocol:ProtocolType}"
```

Health checks:

```bash
curl "$RAMIS_API_URL/health"
curl "${NEXT_PUBLIC_LANDING_API_URL}/health"
```

Landing `GET /health` returns `{ "ok": true }`. RAMIS `GET /health` returns `{ "status": "ok", "service": "ramis-mock" }` plus the ledger counts.
