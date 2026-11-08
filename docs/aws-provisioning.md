# Provision the AWS pipeline

Run these from the repo root, in order. The default region is `ap-south-1`.

S3, SQS, the invoice-engine Lambda, EventBridge, and the two HTTP APIs come from `tools/deployment`. SFTP is separate: `npm run onboard:sftp` creates the Transfer server and one password per organization after the bucket exists. The invoice-engine Lambda has no API Gateway. SQS invokes it. API Gateway sits in front of the RAMIS and landing Lambdas only.

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
| RAMIS hostname | `stag-ramis.api.invoz.lk`, or `ramis.api.invoz.lk` on prod |
| Landing hostname | `stag-landing.api.invoz.lk`, or `landing.api.invoz.lk` on prod |
| Transfer Family role | `invoz-{env}-transfer` |
| SFTP identity Lambda | `invoz-{env}-sftp-idp` |
| SAP poll Lambda and role | `invoz-{env}-erp-poll-s4hana`, `invoz-{env}-erp-poll-role` |
| SAP poll schedule | `invoz-{env}-erp-poll-s4hana` `rate(1 minute)` |

`npm run provision` runs S3, SQS, Lambda, and EventBridge in one shot. Use the steps below when you want to create one resource at a time. EventBridge has no script of its own. The full `npm run provision` command is what attaches it, and that command is safe to repeat.

## Before you start

Install the AWS CLI, Node.js, `zip`, and `python3`. The machine's AWS credentials need permission to create S3 buckets, SQS queues, EventBridge rules, IAM roles, Lambda functions, SNS topics, CloudWatch alarms, and HTTP APIs (`apigatewayv2`), including custom domain names and API mappings. The RAMIS and landing publishes call `acm:DescribeCertificate` on `API_CERTIFICATE_ARN`. Requesting that certificate needs `acm:RequestCertificate`. The SFTP step also needs `transfer:*` on that account.

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
| `API_CERTIFICATE_ARN` | RAMIS and landing | ISSUED ACM certificate in `AWS_REGION`. `*.api.invoz.lk` covers both hostnames. |

Each Lambda takes its environment from the `.env` in its package. `tools/deployment/.env` is not copied onto a function.

| Package | Deploy command |
| --- | --- |
| `packages/invoice-engine/.env` | `npm run provision:lambda -w @invoz/deployment` |
| `tools/ramis-engine/.env` | `npm run provision:ramis` |
| `packages/landing-service/.env` | `npm run provision:landing` |
| `packages/erp-poll/.env` | `npm run provision:erp-poll-lambda -w @invoz/deployment` |

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

Create one bucket named `invoz-{env}-invoices`. Each organization is the prefix `uploads/{organization id}/`. The bucket blocks public access, encrypts objects with SSE-S3, turns on versioning, and allows S3 to send object-created events to EventBridge.

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
s3://invoz-${APP_ENV}-invoices/uploads/{organization_id}/{legal_entity_id}/{branch_id}/inbound/{file}.csv
```

Keys ending in `.csv.tmp` do not match the EventBridge rule. The rule matches this bucket only.

## 2. SFTP

One public SFTP server per environment. One password per organization, chrooted to `uploads/{organization id}/` in the shared bucket. The server is billed for every hour it exists, plus the data uploaded. The first run creates the Transfer server, the identity-provider Lambda, and the IAM role. Later runs add another organization.

The arguments are the environment and the organization slug. `npm run onboard -- <stag|prod> <slug>` must already have created that organization. The username is `organizations.id`. The password is printed once and written to `supabase/seeders/<env>/<slug>/sftp.json`. The database table `sftp_credentials` keeps a scrypt hash of that password. The identity-provider Lambda reads the hash when the customer signs in. The environment argument has to match `APP_ENV`.

```bash
npm run onboard:sftp -- stag talentuner
```

Replace an existing password with `--rotate`. The script loads `tools/deployment/.env` when `APP_ENV` is not already set.

An upload of `/{legal_entity_id}/{branch_id}/inbound/invoice_001.csv` is stored as `uploads/{organization_id}/{legal_entity_id}/{branch_id}/inbound/invoice_001.csv`. Connect with the printed host, username, and password:

```bash
sftp "101@s-0123456789abcdef0.server.transfer.${AWS_REGION}.amazonaws.com"
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

Publishes `invoz-${APP_ENV}-invoice-engine` (Node.js 22, 512 MB, 60 second timeout) and maps `invoz-${APP_ENV}-invoicing-pipeline.fifo` to it with batch size 5. `packages/invoice-engine/.env` must contain `DATABASE_URL`, `RAMIS_API_URL`, and `RAMIS_CLIENT_SECRET`. The publish exits while any of the three is empty. `RAMIS_API_URL` is `https://stag-ramis.api.invoz.lk` on staging and `https://ramis.api.invoz.lk` on prod, with no path. `RAMIS_CLIENT_SECRET` is the secret the RAMIS API checks. For the mock, copy `RAMIS_MOCK_CLIENT_SECRET` from `tools/ramis-engine/.env`. The publish copies the generated Prisma client into the zip. The queue from step 3 must exist. Step 5 runs this same publish, so those three values have to be set before `npm run provision` as well.

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

The worker environment is `packages/invoice-engine/.env`. `DATABASE_URL` is the clearance transaction, and it must be the session pooler on port 5432. The direct `db.{ref}.supabase.co` host is IPv6-only, so Lambda cannot open it. `RAMIS_API_URL` and `RAMIS_CLIENT_SECRET` are the RAMIS call. If either value changes after step 6, source `tools/deployment/.env` again and run `npm run provision:lambda -w @invoz/deployment`. That publish also creates alarm `invoz-${APP_ENV}-invoice-engine-ramis-commit-failed` on metric `Invoz/InvoiceEngine` `RamisClearedCommitFailed`, and sends it to SNS topic `invoz-${APP_ENV}-critical`. The topic is created by this command. It has no email subscription until you add one.

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

## ERP polling

SFTP stays the default. Polling runs only when `organizations.polling_enabled` is true and an organization `erp_connections` row has `ingestion_mode = 'poll'` and `status = 'live'`. `npm run provision` does not create this schedule.

`packages/erp-poll/.env` must contain `DATABASE_URL` and `INVOICE_BUCKET` (`invoz-${APP_ENV}-invoices`). The Lambda script adds `APP_ENV` from the shell. Each polling row stores its billing document API and API key. The poller sends the key in the `APIKey` header. One organization has one SFTP integration and can have several polling configs for the same ERP. A legal entity on the row is optional. The portal form asks for the billing document API, the API key, the configuration name, an optional starting billing document, and an optional legal entity. It sends an enable or disable request and does not change `status` itself. Only SAP (`s4hana`, `sap_ecc`, `sap_b1`) and IFS can be requested for polling. Set the billing document API to the `API_BILLING_DOCUMENT_SRV` service root, and set the starting billing document before go-live if older documents must not be submitted.

```bash
npm run provision:erp-poll-lambda -w @invoz/deployment
npm run provision:erp-poll-schedule -w @invoz/deployment
```

Check:

```bash
aws lambda get-function-configuration \
  --function-name invoz-${APP_ENV}-erp-poll-s4hana \
  --region "$AWS_REGION" \
  --query '{State:State,Handler:Handler,Timeout:Timeout}'

aws events describe-rule \
  --name invoz-${APP_ENV}-erp-poll-s4hana \
  --region "$AWS_REGION" \
  --query '{State:State,Schedule:ScheduleExpression}'
```

The function reads billing documents `F2` and `FX` in ascending `BillingDocument` order, 100 per page and at most 5 pages per run. After each full page is written to `uploads/{organization_id}/{legal_entity_id}/{branch_id}/inbound/poll-{invoiceId}.csv`, it stores that page's last id. The existing S3 rule then clears the file.

## Upload invoices

Inbound CSVs for each environment live in `tools/invoice-uploader`:

```text
tools/invoice-uploader/invoices/{env}/{organization_slug}/{legal_entity_id}/{branch_id}/inbound/{file}.csv
```

`{env}` is `stag` or `prod`. `npm run sync:invoices -- stag <slug>` signs in with `tools/invoice-uploader/sftp/<slug>.env` and writes `/{legal_entity_id}/{branch_id}/inbound/{file}.csv`. The user is chrooted at `uploads/{organization_id}/`, so the object lands on the same key as a customer upload. A file is sent when the remote file is missing or a different size. `.csv.tmp` files and any file outside `inbound/` are skipped.

`npm run onboard:sftp -- <stag|prod> <slug>` writes that env file. It contains `SFTP_HOST`, `SFTP_USERNAME` (the organization id), and `SFTP_PASSWORD`. Copy `tools/invoice-uploader/sftp/env.example` when you need to fill it in by hand.

```bash
npm run sync:invoices -- stag tesla
```

Without the slug, the command uploads every organization folder under `invoices/stag` that has a matching env file.

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

Two HTTP APIs, each forwarding `ANY /` and `ANY /{proxy+}` to one Lambda with payload format 2.0. Neither API adds auth or throttling. CORS for the landing site is handled inside `landing-service`. Each API is also served on a regional custom domain. TLS is 1.2. The hostname depends on `APP_ENV`:

| `APP_ENV` | RAMIS | Landing |
| --- | --- | --- |
| `stag` | `stag-ramis.api.invoz.lk` | `stag-landing.api.invoz.lk` |
| `prod` | `ramis.api.invoz.lk` | `landing.api.invoz.lk` |

| API name | Lambda | Timeout | Memory | Caller |
| --- | --- | --- | --- | --- |
| `invoz-{env}-ramis-engine` | `invoz-{env}-ramis-engine` | 30 s | 512 MB | `invoz-{env}-invoice-engine`, through `RAMIS_API_URL` |
| `invoz-{env}-landing-service` | `invoz-{env}-landing-service` | 20 s | 256 MB | `landing-app`, through `NEXT_PUBLIC_LANDING_API_URL` |

### Certificate

Request one public certificate in the API region. `*.api.invoz.lk` covers all four hostnames. A certificate in another region cannot be attached to these regional domains.

```bash
aws acm request-certificate \
  --region "$AWS_REGION" \
  --domain-name "*.api.invoz.lk" \
  --validation-method DNS \
  --query CertificateArn \
  --output text
```

In the `invoz.lk` hosted zone, create the CNAME that ACM prints under `DomainValidationOptions`. The record name is the validation host, not the API hostname.

```bash
aws acm describe-certificate \
  --region "$AWS_REGION" \
  --certificate-arn "$API_CERTIFICATE_ARN" \
  --query 'Certificate.DomainValidationOptions[].ResourceRecord'
```

Wait until the status is `ISSUED`, then set `API_CERTIFICATE_ARN` in `tools/deployment/.env` and load it again:

```bash
aws acm wait certificate-validated \
  --region "$AWS_REGION" \
  --certificate-arn "$API_CERTIFICATE_ARN"

set -a
source tools/deployment/.env
set +a
```

### Publish

`npm run provision:ramis` publishes `tools/ramis-engine/.env`. That file must contain `RAMIS_DATABASE_URL` and `RAMIS_MOCK_CLIENT_SECRET`. The function sets `search_path` to `ramis_engine`. `npm run provision:landing` publishes `packages/landing-service/.env`, which must contain `DATABASE_URL`, and copies the generated Prisma client into the zip. Demo email is off unless `LANDING_EMAIL_ENABLED` is `true`. Both commands refuse to run until `API_CERTIFICATE_ARN` is an issued certificate in `AWS_REGION` that covers the hostname. Each command creates the custom domain when it is missing, maps it to the `$default` stage, and prints the Route 53 alias target. Create that alias after the command prints it. The target does not exist before the domain does.

```bash
npm run provision:ramis
npm run provision:landing
```

`npm run provision:ramis` prints the value for `RAMIS_API_URL`. It is the custom domain, with no path:

```text
https://stag-ramis.api.invoz.lk
```

On prod that host is `ramis.api.invoz.lk`. If `RAMIS_API_URL` in `packages/invoice-engine/.env` is not already that URL, paste it in, then publish the worker:

```bash
set -a
source tools/deployment/.env
set +a
npm run provision:lambda -w @invoz/deployment
```

`npm run provision:landing` prints `https://stag-landing.api.invoz.lk`, or `https://landing.api.invoz.lk` on prod. Set that as `NEXT_PUBLIC_LANDING_API_URL` on `landing-app`. It does not belong in `tools/deployment/.env`.

### Route 53

In the `invoz.lk` hosted zone, create one alias A record per hostname. The console appends `.invoz.lk`, so the record name for staging RAMIS is `stag-ramis.api`.

1. Route 53, Hosted zones, `invoz.lk`, Create record.
2. Record name: `stag-ramis.api`, `stag-landing.api`, `ramis.api`, or `landing.api`.
3. Record type: A. Turn on Alias.
4. Route traffic to: Alias to API Gateway API, region `ap-south-1`.
5. Choose the endpoint printed as the alias target, `d-xxxxxxxx.execute-api.ap-south-1.amazonaws.com`.

The same record from the CLI, after you copy the target and alias hosted zone id from the provision output. `ZONE_ID` is the `invoz.lk` hosted zone, not the API Gateway zone.

```bash
ZONE_ID=$(aws route53 list-hosted-zones-by-name \
  --dns-name invoz.lk \
  --query "HostedZones[?Name=='invoz.lk.'].Id | [0]" \
  --output text)

cat > /tmp/api-alias.json <<EOF
{
  "Changes": [
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "stag-ramis.api.invoz.lk",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "ALIAS_HOSTED_ZONE_FROM_PROVISION",
          "DNSName": "d-xxxxxxxx.execute-api.${AWS_REGION}.amazonaws.com",
          "EvaluateTargetHealth": false
        }
      }
    }
  ]
}
EOF

aws route53 change-resource-record-sets \
  --hosted-zone-id "$ZONE_ID" \
  --change-batch file:///tmp/api-alias.json
```

Repeat for the landing hostname in this environment. Prod uses `ramis.api.invoz.lk` and `landing.api.invoz.lk`, each with the target printed by that environment's publish. Do not point two hostnames at one API Gateway domain name.

Check both domains for the current `APP_ENV`, then call health after the alias resolves:

```bash
if [[ "$APP_ENV" == "prod" ]]; then
  RAMIS_HOST=ramis.api.invoz.lk
  LANDING_HOST=landing.api.invoz.lk
else
  RAMIS_HOST=stag-ramis.api.invoz.lk
  LANDING_HOST=stag-landing.api.invoz.lk
fi

aws apigatewayv2 get-domain-name \
  --domain-name "$RAMIS_HOST" \
  --region "$AWS_REGION" \
  --query 'DomainNameConfigurations[0].{Target:ApiGatewayDomainName,Zone:HostedZoneId}'

aws apigatewayv2 get-domain-name \
  --domain-name "$LANDING_HOST" \
  --region "$AWS_REGION" \
  --query 'DomainNameConfigurations[0].{Target:ApiGatewayDomainName,Zone:HostedZoneId}'

curl "https://${RAMIS_HOST}/health"
curl "https://${LANDING_HOST}/health"
```

Landing `GET /health` returns `{ "ok": true }`. RAMIS `GET /health` returns `{ "status": "ok", "service": "ramis-mock" }` plus the ledger counts.
