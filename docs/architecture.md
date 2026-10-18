# Architecture

The ingestion pipeline runs on AWS. Supabase is the application database, authentication, and the database behind the portals. Supabase cannot host the SFTP, FIFO, and queue-triggered worker path.

## Why the pipeline is not on Supabase

* **No managed SFTP.** Supabase Storage has no SFTP endpoint. An ERP cannot connect with SSH keys and drop files into a bucket.
* **No SQS FIFO equivalent.** `pgmq` queues inside Postgres bloat tables, saturate connections, and do not lock a message group the way a FIFO queue does.
* **No queue-triggered compute.** Supabase Edge Functions run from HTTP or webhooks. They do not poll a FIFO queue with batching, concurrency limits, and a dead-letter queue the way Lambda does with an SQS event source mapping.

Amazon Aurora, Cognito, and App Runner are not part of this system. Postgres, Auth, and Row-Level Security stay on Supabase. The Next.js apps stay in this repo.

```mermaid
flowchart LR
  erp[ERP]
  sftp[Transfer Family SFTP]
  s3[S3]
  events[EventBridge]
  fifo[SQS FIFO]
  lambda["Lambda<br/>@ramis/invoice-engine"]
  secrets[Secrets Manager]
  dlq[SQS FIFO DLQ]
  db[("Supabase Postgres")]
  portal[portal-app]
  admin[admin-app]
  landing[landing-app]

  erp --> sftp --> s3 --> events --> fifo --> lambda
  secrets --> lambda
  lambda -->|cleared or rejected| db
  lambda -->|retry exhausted| dlq
  lambda -->|archive file| s3
  portal --> db
  admin --> db
  landing --> db
```

## AWS pipeline

| Tier | Service | Role |
| --- | --- | --- |
| SFTP ingestion | AWS Transfer Family | Managed SFTP. ERP SSH keys land in `/uploads/{organization_id}/{legal_entity_id}/inbound/`. |
| Storage | Amazon S3 | Object-created events for `.csv` files only. `.csv.tmp` uploads are ignored. Sibling prefixes: `processed`, `rejected`, `acknowledgments`. |
| Routing | Amazon EventBridge | Forwards a created-object event into the FIFO queue. |
| Sequencing | Amazon SQS FIFO `invoicing-pipeline.fifo` | `MessageGroupId = {legalEntityId}:{branchCode}` so one branch of one legal entity is strictly ordered. `MessageDeduplicationId` is the file SHA-256. Visibility timeout is 5 minutes. |
| Worker | AWS Lambda | Event source mapping, batch size 1 to 5. Runs `@ramis/invoice-engine`. Parses the file with that legal entity's field mapping, checks TIN, dates, and VAT, allocates the Gazette serial in Supabase, and posts to RAMIS over mutual TLS. |
| Certificates | AWS Secrets Manager | RAMIS client certificate and private key, encrypted with KMS. `ramis_credentials.certificate_secret_arn` stores the ARN. |
| Failures | Amazon SQS FIFO `invoicing-pipeline-dlq.fifo` | Messages that still fail after 3 receives. Unparseable files and permanent 4xx outcomes are recorded as rejected before that. |
| Operations | CloudWatch and SNS | Queue depth, Lambda duration, and DLQ alarms. |

A legal entity keeps its own serial lane per branch. The FIFO group is `{legalEntityId}:{branchCode}`, not the organization id. Two subsidiaries in one organization must not share a sequence.

Webhook ingestion uses the same queue and the same worker. The job `source` is `webhook` and the body carries `payload` instead of an S3 key.

## Processing flow

1. The ERP uploads `invoice_001.csv` through Transfer Family.
2. Transfer Family writes `s3://…/uploads/{organization_id}/{legal_entity_id}/inbound/invoice_001.csv`.
3. S3 emits an object-created event to EventBridge.
4. EventBridge sends a message to `invoicing-pipeline.fifo` with `MessageGroupId = {legalEntityId}:{branchCode}`.
5. Lambda reads the message and runs `handler` from `@ramis/invoice-engine`:
   * download and parse the file with the legal entity field mapping
   * check 9-digit TINs, separate invoice and supply dates, and VAT math
   * allocate `YYMMM_QQQQ_XXXXX` in Supabase
   * POST the payload to the RAMIS Web API with the certificate from Secrets Manager
6. The worker then writes state back to Supabase and moves the file:
   * **HTTP 200/201:** status `cleared`, file moves to `processed`, acknowledgment file is written for the ERP
   * **HTTP 4xx:** status `rejected` with the IRD error, file moves to `rejected`
   * **HTTP 5xx or timeout:** the worker throws, the message becomes visible again, and SQS retries. The document is not marked rejected.
7. `portal-app` reads Supabase for the clearance queue, Schedule 02 matching, and the allowance. Supabase Auth and Row-Level Security scope each user to a membership.

RAMIS submission is not implemented yet. `processInvoiceJob` checks that the legal entity belongs to the organization on the job, then fails so SQS can retry.

```mermaid
sequenceDiagram
  participant ERP
  participant S3
  participant FIFO as invoicing-pipeline.fifo
  participant Lambda as @ramis/invoice-engine
  participant DB as Supabase Postgres
  participant RAMIS

  ERP->>S3: invoice_001.csv
  S3->>FIFO: object created
  FIFO->>Lambda: batch
  Lambda->>DB: legal entity and next serial
  Lambda->>RAMIS: mTLS submit
  alt cleared or rejected
    Lambda->>DB: status and receipt
    Lambda->>S3: processed or rejected
  else gateway 5xx
    Lambda-->>FIFO: batch item failure
  end
```

## Supabase

Supabase holds operational state and serves the apps. It does not receive ERP files and it does not run the worker.

| Path | What it does |
| --- | --- |
| `migrations/0001_initial.sql` | Organizations, legal entities, branches, memberships, invoices, adjustments, serials, credentials, usage, audit log, and Row-Level Security. |
| `seeders/` | JSON seed objects exported from `seeders/index.ts`. |
| `scripts/migrate.ts` | Applies `migrations` and records each file in `schema_migrations`. |
| `scripts/seed.ts` | Inserts every seed object using `tableColumns` from `@ramis/common`. |
| `er-diagram.md` | Entity diagram for the migration. |

The Lambda handler is `handler` in `@ramis/invoice-engine`. There is no Supabase Edge Function and no database queue.

Tables:

* `organizations`, `legal_entities`, `branches`, `memberships`
* `field_mappings`, `ramis_credentials`, `serial_counters`
* `outbound_invoices`, `outbound_adjustments`
* `inbound_invoices`, `inbound_adjustments`
* `invoice_usage`, `audit_logs`

## Workspace

```text
ramis-middleware
├── apps
│   ├── landing-app          public site, port 3002
│   ├── portal-app           organization portal, port 3000
│   └── admin-app            platform admin, port 3001
├── packages
│   ├── common               @ramis/common
│   ├── invoice-engine       Lambda worker
│   └── deployment           S3, SQS, and Lambda shell scripts
└── supabase                 database, seed data, scripts
```

| App | Port | Role |
| --- | --- | --- |
| `landing-app` | 3002 | Public site. |
| `portal-app` | 3000 | One organization. Overview, invoices, Schedule 02, field mapping, branches, users, subscription. Roles come from `@ramis/common`. |
| `admin-app` | 3001 | Platform admin. |

`@ramis/common` is shared by the apps, the Lambda, and the seeder.

| Export | Contents |
| --- | --- |
| `entities` | Domain types and enums: `PortalRole`, `InvoiceClass`, `AdjustmentType`, `RamisStatus`, `MatchingStatus` |
| `models` | Snake-case row types, `tableColumns`, and row-to-entity mappers |
| `queues` | `invoicing-pipeline.fifo`, `invoicing-pipeline-dlq.fifo`, `InvoiceJob`, `invoiceMessageGroupId`, `invoiceMessageDeduplicationId`, `parseInvoiceJob` |
| `utils` | Slug, TIN, branch code, payload hash, Gazette serial formatting, `portalRoleLabel` |

An `InvoiceJob` has `organizationId`, `legalEntityId`, `branchCode`, and `source` (`s3` or `webhook`). S3 jobs include `objectKey`. Webhook jobs include `payload`.

## Commands

| Command | Runs |
| --- | --- |
| `npm run dev:landing` | Landing app |
| `npm run dev:portal` | Portal app |
| `npm run dev:admin` | Admin app |
| `npm run typecheck` | Every workspace package |
| `npm run migrate` | `supabase/scripts/migrate.ts` |
| `npm run seed` | `supabase/scripts/seed.ts` |
| `npm run provision` | `packages/deployment/provision.sh` |

`npm run migrate` and `npm run seed` read `supabase/.env`. The portal reads `apps/portal-app/.env`. `npm run provision` reads `AWS_REGION`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`. Copy `packages/deployment/env.example` to set them.
