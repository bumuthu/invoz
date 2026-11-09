# Admin app

The admin app is the platform console for onboarding customers. It runs at port 3001 from `apps/admin-app`. One super admin has every action. There is no permission matrix and no second admin account.

The super admin is a Supabase Auth user whose email matches `ADMIN_EMAIL`. That user is not a member of a customer organization and does not appear in the portal. Customer data is read and written with Prisma on `DATABASE_URL`. Auth admin calls use the service role. `ADMIN_EMAIL`, `APP_ENV` (`stag` or `prod`), and `AWS_REGION` stay on the server.

`npm run onboard` and the SFTP and polling scripts still work. The admin app is the screen for the same database changes. It does not write a folder under `supabase/seeders/`.

## Sign-in

The admin signs in with email and password. A session whose email does not match `ADMIN_EMAIL` is sent back to the login page. The app does not list, invite, or remove admins. Create the Auth user once in Supabase.

## Screens

| Screen | Path | What it does |
| --- | --- | --- |
| Overview | `/` | Accepted and rejected invoice totals, then one row per organization. |
| Organizations | `/organizations` | Every organization. Open one to manage it, or start a new one. |
| New organization | `/organizations/new` | Onboard a customer. |
| Organization | `/organizations/{id}` | Name, subscription, legal entities, branches, members, and that organization's connection rows. |
| Connections | `/connections` | RAMIS enablement and ERP connection details for every organization and legal entity. |
| Requests | `/requests` | Pending SFTP and ERP polling requests. |
| Leads | `/leads` | Demo requests from the public site. Read only. |

## Analytics

Counts come from `outbound_invoices` and `outbound_adjustments`, grouped by organization, legal entity, and `ramis_status`.

Accepted is `cleared`. Rejected is `rejected`. Draft, validated, queued, and skipped are shown as well, so the statuses add up to the total.

A control switches the invoice date between the current calendar month and all time. Each organization row also shows this month's `invoice_usage.cleared_count` against `monthly_allowance`. The organization page repeats the status counts for each of its legal entities.

## Onboard an organization

`/organizations/new` collects the same facts as `npm run onboard`:

- Organization name, slug, and monthly allowance. The slug uses the same rules as `assertOrganizationSlug`: lowercase letters, digits, and hyphens, 1 to 63 characters, and not `www`, `admin`, `app`, or `api`.
- Owner name, email, and initial password. The app creates the Auth user and one membership with role `owner`.
- At least one legal entity: name, 9-digit TIN, and optional VAT number.
- At least one branch on each legal entity: code and name. The code is 1 to 15 letters or digits.

The insert is one transaction and writes an `organization.onboarded` audit row. Serial counters stay empty until the first gazette serial is issued.

If the owner email already belongs to an organization, the form stops and does not reset that password. Organizations are not deleted from the admin app.

## Manage an organization

On the organization page the super admin can:

- Change the organization name.
- Add a legal entity or a branch.
- Turn `ramis_enabled` on or off for a legal entity.
- Update the subscription, described below.

Members are listed with email and portal role. Inviting and changing those roles stays in the customer portal. The owner invites everyone else from Users.

## Subscription

The subscription is `organizations.monthly_allowance`: how many cleared invoices the organization may submit in a month. Cleared invoices from every legal entity count toward that one allowance. The portal shows this number on `/subscription` and cannot change it.

The organization page shows this month's cleared count next to the allowance. Saving a new allowance requires a positive integer and writes an audit row. Plan name and overage rate stay the constants the portal already displays. There is no separate subscription table.

## Connections

`/connections` is one read-only table. The organization page shows the same columns for that organization only.

RAMIS is per legal entity: `legal_entities.ramis_enabled`, and whether a `ramis_credentials` row exists. ERP connections are per organization. `erp_connections.legal_entity_id` is not set, so a connection covers every legal entity in that organization.

Each table row is one legal entity joined to one ERP connection of its organization. Two connections produce two rows for each legal entity. An organization with no connection produces one row per legal entity and empty ERP columns.

| Column | Source |
| --- | --- |
| Organization, slug | `organizations` |
| Legal entity, TIN | `legal_entities` |
| RAMIS | `ramis_enabled` |
| Certificate on file | a `ramis_credentials` row exists |
| Mode | `ingestion_mode`: `sftp` or `poll` |
| ERP, label | `erp_code`, `label` |
| Status | `live` or `offline` |
| Endpoint | poll `endpoint_url` |
| Last polled, last error | poll columns |

`api_secret` and `certificate_secret_arn` are not sent to the browser.

## SFTP requests

Customers request SFTP from the portal. Those rows are `erp_change_requests` on the organization's SFTP connection (`ingestion_mode = sftp`). The queue shows the organization, ERP, requester, action (`enable` or `disable`), and whether `sftp_credentials` already exists. The password hash is never shown.

Approving an enable request does the per-organization part of `npm run onboard:sftp`. It does not create the Transfer server, the identity-provider Lambda, or the IAM roles.

1. When no credential exists, generate a password and store its scrypt hash with `hashSecret`. The identity provider checks that same hash. The username is the numeric organization id.
2. Read the Transfer server id from SSM `/invoz/{APP_ENV}/transfer-server-id` and write `uploads/{organizationId}/.keep` to the bucket `invoz-{APP_ENV}-invoices`.
3. In one transaction, set the connection to `live`, mark the request `approved`, and write an `erp.enabled` audit row.

The screen shows the host, the username, and the password once, and only when a password was just created. If a credential already exists, approval leaves it in place. Rotate replaces the hash and shows the new password once. The app does not write `supabase/seeders/<env>/<slug>/sftp.json`.

If the Transfer server parameter is missing, approval fails and the connection stays offline. Create the server once with the deployment scripts in [aws-provisioning.md](aws-provisioning.md).

Approving a disable request sets the connection to `offline` and leaves the credential in place. Rejecting a request sets it to `rejected` and leaves the connection unchanged.

## ERP polling requests

The same queue, limited to `ingestion_mode = poll`. The API key in `api_secret` is never sent to the browser. The queue shows the ERP code, label, and endpoint.

Approving an enable request follows `npm run enable:poll`: the connection becomes `live`, the request becomes `approved`, `organizations.polling_enabled` becomes true, and an `erp.enabled` audit row is written.

Approving a disable request sets that connection to `offline`. `polling_enabled` becomes false only when the organization has no other live polling connection. Rejecting a request leaves the connection unchanged.

## Leads

`/leads` lists `demo_requests` captured by the public site: name, email, phone, company, ERP, note, and when it was created. The admin app does not edit or delete them.

## Left on the command line

These stay outside the admin app:

- The Transfer server, the identity-provider Lambda, and the Transfer IAM role.
- `npm run onboard` from a seeder folder, for organizations that are still described as JSON.
- `npm run onboard:sftp`, which also writes `sftp.json` and the invoice-uploader env file. The admin app issues the password on screen instead.
