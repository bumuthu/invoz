#	Feature	Necessity
1	Automated SFTP invoice ingestion	🔴 Critical
2	REST webhook invoice ingestion (`POST /v1/invoices`)	🔴 Critical
3	Dynamic field mapper (tenant export-column mapping)	🔴 Critical
4	Gazette sequential serial numbering (`YYMMM_QQQQ_XXXXX`, monthly reset, branch isolation)	🔴 Critical
5	Invoice validation before submission	🔴 Critical
6	Customer/TIN & master-data validation (9-digit TIN, invoice vs supply date)	🔴 Critical
7	Tax/VAT validation (line subtotals, 18% VAT, grand-total math)	🔴 Critical
8	RAMIS API integration & submission (mutual TLS)	🔴 Critical
9	Credit & debit note processing (Schedule 04, linked to original clearance ID)	🔴 Critical
10	Submission status tracking (`SUBMITTING` / `CLEARED` / `REJECTED`)	🔴 Critical
11	Rejection/error handling & resubmission	🔴 Critical
12	Invoice dashboard — accepted/rejected/pending/failed	🔴 Critical
13	CBSL foreign-currency conversion to LKR	🟠 Very High
14	ERP acknowledgment files (`/acknowledgments/` for ERP ingest)	🟠 Very High
15	Idempotent submission (payload SHA-256 hash)	🟠 Very High
16	Automatic retry / failure recovery (exponential backoff, DLQ, outage buffering)	🟠 Very High
17	Complete audit trail — ERP → SFTP/webhook → RAMIS → response	🟠 Very High
18	Schedule 02 inward matching & bulk approval (up to 5,000 records)	🟠 Very High
19	Invoice search & filtering	🟠 Very High
20	Notifications & alerts (validation failures, gateway outages, DLQ)	🟡 High
21	Reports, gap analysis & Excel/CSV exports	🟡 High
22	User roles & permissions (tenant RLS)	🟡 High
23	Reconciliation — ERP invoices vs RAMIS submissions	🟡 High
24	Multi-branch numbering isolation (`QQQQ` classification codes)	🟡 High
25	Manual invoice upload (fallback)	🟡 Medium
26	Multi-company / multi-tenant management	🟡 Medium
27	Non-VAT file skip (`SKIPPED_NON_VAT`, no RAMIS submit)	🟡 Medium
28	Windows on-prem sync agent (local folder → HTTPS upload)	🟡 Medium

