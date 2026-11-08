# Onboard a new organization

Run these from the repo root, in order. One organization is one folder, `supabase/seeders/<env>/<slug>/`. `<env>` is `stag` or `prod`. Two commands finish the account: `npm run onboard` writes the database rows and the owner login, and `npm run onboard:sftp` creates that organization's SFTP folder and the password the customer's client uses.

`talentuner` in `supabase/seeders/stag/talentuner/` is a complete example. Copy that shape for the new slug.

The shared invoice bucket, the Transfer server, and the pipeline already exist for the environment. Creating them is in [aws-provisioning.md](aws-provisioning.md). A new organization does not get its own bucket or its own SFTP server.

## Commands

Replace `stag` with `prod` when the organization belongs in production, and replace `acme` with the organization slug.

```bash
npm install
npm run onboard -- stag acme
npm run onboard:sftp -- stag acme
```

| Command | What it does |
| --- | --- |
| `npm run onboard -- <stag\|prod> <slug>` | Creates the organization, legal entities, branches, serial counters, and the owner account from `supabase/seeders/<env>/<slug>/`. |
| `npm run onboard:sftp -- <stag\|prod> <slug>` | Creates the SFTP folder `uploads/{organization id}/` and a password. Writes `supabase/seeders/<env>/<slug>/sftp.json` and `tools/invoice-uploader/sftp/<slug>.env`. |
| `npm run onboard:sftp -- <stag\|prod> <slug> --rotate` | Replaces the SFTP password and rewrites `sftp.json`. |

Run `npm run onboard -- stag acme` again to add a row that was missing. It leaves an existing owner password as it is. Run `npm run onboard:sftp -- stag acme` again when the password already exists and it prints the host and username, then stops. The first argument has to match `APP_ENV` in `tools/deployment/.env`.

## Before you start

`supabase/.env` is the database this organization is written into. `tools/deployment/.env` is the AWS environment the SFTP folder is created in. Point both at the same environment, `stag` or `prod`, before the commands below.

```bash
aws sts get-caller-identity
```

`supabase/.env` needs `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `DATABASE_URL`. Copy it from `supabase/.env.example` when the file is missing.

`tools/deployment/.env` needs `APP_ENV` (`stag` or `prod`) and `AWS_REGION` (default `ap-south-1`). The invoice bucket `invoz-{APP_ENV}-invoices` must already exist. `npm run onboard:sftp` loads that file when `APP_ENV` is not already set in the shell, then checks that it matches the `stag` or `prod` argument.

The AWS credentials need `transfer:*`, Secrets Manager, SSM, S3, Lambda, and IAM on that account. The first organization in an environment also creates the Transfer server, the identity-provider Lambda, and the Transfer IAM role. Later organizations only add a password and a folder.

## 1. Write the seeder

Create `supabase/seeders/<env>/<slug>/`. `<env>` is `stag` or `prod`. The folder name under that is the slug. It is lowercase letters, digits, and hyphens, 1 to 63 characters, and it cannot be `www`, `admin`, `app`, or `api`.

The folder needs `owner.json`. The other files below are how a normal organization is described. `sftp.json` is written later by `npm run onboard:sftp` and is gitignored. Do not put a password you want kept secret into a file other than `sftp.json`.

Every `ref` is a name you choose inside this folder. Other files point at that name. The database assigns the numeric ids.

### `organizations.json`

One organization. `slug` matches the folder name. `monthly_allowance` is a positive integer, the invoice allowance for the month.

```json
{
  "organizations": [
    {
      "ref": "acme",
      "name": "Acme Pvt Ltd",
      "slug": "acme",
      "monthly_allowance": 5000
    }
  ]
}
```

### `owner.json`

One auth user and one membership with `"role": "owner"`. `user_id` and `organization_id` are `ref` values, not database ids.

```json
{
  "auth_users": [
    {
      "ref": "owner",
      "email": "owner@acme.lk",
      "name": "Acme Owner",
      "password": "choose-a-password"
    }
  ],
  "memberships": [
    { "user_id": "owner", "organization_id": "acme", "role": "owner" }
  ]
}
```

The owner invites everyone else from Users in the portal. Add no other membership in this folder.

### `legal_entities.json`

`tin` is 9 digits. `organization_id` is the organization `ref`.

```json
{
  "legal_entities": [
    {
      "ref": "acme-entity",
      "organization_id": "acme",
      "name": "Acme Pvt Ltd",
      "tin": "102345678"
    }
  ]
}
```

### `branches.json`

`code` is 1 to 15 letters or digits. It is the branch code printed in the Gazette serial `YYMMM_CODE_XXXXX`. `legal_entity_id` is the legal entity `ref`.

```json
{
  "branches": [
    {
      "ref": "branch-cmb",
      "legal_entity_id": "acme-entity",
      "code": "CMB",
      "name": "Colombo depot"
    }
  ]
}
```

### Invoice columns

Column headers come from the connected ERP's schedule 01 map. That map is system data in `supabase/seeders/system/erp_field_mappings.json`: one JSON object per ERP and schedule, each key a CSV column and each value the RAMIS field. A header that matches `invoice no` is the invoice number when that map has no `header.erp_reference` column.

### `serial_counters.json`

Include this file when a branch has already issued serials and the next number must continue that sequence. `period` looks like `26NOV`. `last_value` is the last number already issued, and it must be greater than 0. The next clearance uses `last_value + 1`.

Leave the file out when the branch starts at `00001`. The database creates that first counter on the first clearance.

```json
{
  "serial_counters": [
    {
      "branch_id": "branch-cmb",
      "legal_entity_id": "acme-entity",
      "period": "26NOV",
      "last_value": 42
    }
  ]
}
```

## 2. Create the organization

```bash
npm run onboard -- stag acme
```

A successful run prints the numeric organization id, each legal entity id, each branch id, the owner email, and the SFTP prefix:

```text
organization 101 acme
legal entity 202 102345678 Acme Pvt Ltd
branch 7 CMB Colombo depot
owner owner@acme.lk
sftp prefix uploads/101/
```

Keep those ids. The SFTP client uploads into `/{legal_entity_id}/{branch_id}/inbound/`. The numbers above are an illustration. The command prints the real ones.

The owner signs in at `https://acme.app.invoz.lk` in production and `https://acme.app-stag.invoz.lk` on staging, with the email and password from `owner.json`.

## 3. Create the SFTP folder and password

```bash
npm run onboard:sftp -- stag acme
```

This command:

1. Reads the numeric id for `acme` from the database. It stops when `npm run onboard -- stag acme` has not been run.
2. Creates the Transfer server for this `APP_ENV` when it does not exist yet.
3. Stores a scrypt password hash in the `sftp_credentials` table. The identity-provider Lambda reads that hash from the database.
4. Creates the folder by writing an empty marker at `s3://invoz-{APP_ENV}-invoices/uploads/{organization id}/.keep`.
5. Chroots that login at `uploads/{organization id}/`. The client sees this folder as `/`.
6. Writes `supabase/seeders/stag/acme/sftp.json` and `tools/invoice-uploader/sftp/acme.env`, and prints the same values.

```text
sftp host s-0123456789abcdef0.server.transfer.ap-south-1.amazonaws.com
username 101
password <printed once>
folder uploads/101/
upload /{legal_entity_id}/{branch_id}/inbound/{file}.csv
sftp config supabase/seeders/stag/acme/sftp.json
example /202/7/inbound/invoice.csv
```

`sftp.json` looks like this. It is mode `0600` and gitignored. Send the password to the customer through a channel other than the repository.

```json
{
  "host": "s-0123456789abcdef0.server.transfer.ap-south-1.amazonaws.com",
  "username": "101",
  "password": "<the password>"
}
```

The username is the organization id, not the slug and not an email. One password covers every legal entity and branch of that organization. A second organization is a second slug and a second `npm run onboard:sftp`.

Replace a password that was lost or shared too widely:

```bash
npm run onboard:sftp -- stag acme --rotate
```

`--rotate` writes a new password hash into `sftp_credentials` and replaces `sftp.json`. Update the customer's client with that password. The folder and the username stay the same.

## 4. Configure the SFTP client

Give the customer the host, username, and password from the command output. The protocol is SFTP on port 22. The remote directory is `/`. That `/` is already `uploads/{organization id}/` in the bucket, so the client must not create an `uploads/` folder of its own.

| Client field | Value |
| --- | --- |
| Protocol | SFTP |
| Host | `host` from `sftp.json` |
| Port | `22` |
| Username | `username` from `sftp.json` (the organization id) |
| Password | `password` from `sftp.json` |
| Remote directory | `/` |

The file the ERP drops:

```text
/{legal_entity_id}/{branch_id}/inbound/{file}.csv
```

Use the ids printed by `npm run onboard` and the `example` lines printed by `npm run onboard:sftp`. For legal entity `202` and branch `7`:

```text
/202/7/inbound/invoice_001.csv
```

That object is stored as:

```text
s3://invoz-{APP_ENV}-invoices/uploads/101/202/7/inbound/invoice_001.csv
```

The branch code inside the CSV must match the branch in that path. A file whose name ends in `.csv.tmp` is ignored. Upload as `{file}.csv.tmp`, then rename it to `{file}.csv` when the write has finished. A key under `processed/`, `rejected/`, or `acknowledgments/` does not start another job.

### OpenSSH

```bash
sftp -P 22 "101@s-0123456789abcdef0.server.transfer.ap-south-1.amazonaws.com"
```

After the password prompt:

```text
mkdir 202
mkdir 202/7
mkdir 202/7/inbound
put invoice_001.csv.tmp /202/7/inbound/invoice_001.csv.tmp
rename /202/7/inbound/invoice_001.csv.tmp /202/7/inbound/invoice_001.csv
```

### FileZilla

1. File, Site Manager, New site.
2. Protocol: SFTP. Host: the Transfer host. Port: `22`.
3. Logon type: Normal. User: the organization id. Password: the value from `sftp.json`.
4. Connect. The listing that opens is the organization folder.
5. Create `{legal_entity_id}/{branch_id}/inbound/` when it is not there, and upload the CSV into `inbound/`.

### WinSCP

1. New site. File protocol: SFTP. Host name: the Transfer host. Port number: `22`.
2. User name: the organization id. Password: the value from `sftp.json`.
3. Login. Remote directory stays `/`.
4. Create `{legal_entity_id}/{branch_id}/inbound/` and upload the CSV there.

## 5. Confirm the first file

From the repo root, with `APP_ENV` set:

```bash
BUCKET="invoz-${APP_ENV}-invoices"
aws s3 ls "s3://${BUCKET}/uploads/${ORGANIZATION_ID}/" --region "${AWS_REGION:-ap-south-1}"
```

After a `.csv` lands in `inbound/`, the EventBridge rule sends the key to `invoz-${APP_ENV}-invoicing-pipeline.fifo` and `invoz-${APP_ENV}-invoice-engine` reads it. The Lambda log group is `/aws/lambda/invoz-${APP_ENV}-invoice-engine`.

A cleared file is moved from `inbound/` to `processed/` on the same legal entity and branch. A file that fails validation is moved to `rejected/` the same way. The client can read both directories with the same login.
