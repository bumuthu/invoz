While I cannot generate an automated file download link or file attachment directly in this chat interface, you can easily save this document as a `.md` file on your computer:

1. Click the **Copy** button at the top or bottom of this message (or select all and copy).
2. Open any text editor (such as Notepad, VS Code, TextEdit, or Obsidian).
3. Paste the contents and save the file with the extension `.md` (for example, `Invoz_Blueprint.md`).

Here is the complete, clean Markdown document:

---

# Invoz: Business Blueprint & Strategic Execution Plan

---

## 1. Executive Summary & Core Value Proposition

The Inland Revenue Department (IRD) of Sri Lanka is implementing a National e-Invoicing System under the National Budget 2026 to modernize Value Added Tax (VAT) collection and curtail systemic revenue leakages. The technical backbone of this initiative is the Revenue Administration Management Information System (RAMIS), which exposes secure Web Application Programming Interfaces (Web APIs) designed to ingest transactional payloads directly from corporate Enterprise Resource Planning (ERP) systems.

Connecting enterprise ERPs directly to RAMIS presents substantial operational and compliance risks for Sri Lankan corporations:

* **Strict Immutability:** Invoices accepted by RAMIS cannot be modified or deleted under any circumstance; corrections require formal Tax Credit/Debit Notes linked to the original invoice identifier.


* **Complex Formatting Mandates:** Gazette Extraordinary No. 2481/22 imposes a rigid sequential numbering taxonomy (`YYMMM_QQQQ_XXXXX`) that standard global ERPs cannot generate without disruptive modifications.


* **Severe Statutory Sanctions:** Failure to comply or submitting inaccurate records carries statutory fines of up to LKR 1,000,000 and imprisonment for up to six months.


* **Gateway Vulnerability:** Government endpoints experience periodic latency and downtime, which can halt billing desks, warehouse dispatches, and point-of-sale checkouts during direct synchronous integrations.



**The Solution:** Invoz is a decoupled, serverless compliance product that acts as an intelligent pre-flight validation buffer, automated serial engine, asynchronous queue, and bidirectional reconciliation platform. By offering low-friction ingestion (SFTP/file-drop and REST webhooks), the platform enables enterprises running SAP, IFS, Microsoft Dynamics, Oracle, and Odoo to achieve compliance within 48 hours without rewriting core ERP software.

---

## 2. Regulatory & Statutory Framework

| Statutory Instrument / Directive | Effective Cutover | Governing Mandate & Scope | Operational & Technical Impact |
| --- | --- | --- | --- |
| **Gazette Extraordinary No. 2481/22**<br> | Promulgated 27 March 2026

 | Mandatory VAT Tax Invoice content specifications across all VAT-registered entities.

 | Requires 9-digit TINs, separate Invoice and Supply dates, CBSL LKR conversions, and `YYMMM_QQQQ_XXXXX` serial format.

 |
| **Gazette Extraordinary No. 2500/106**<br> | 1 October 2026

 | Formal postponement of binding Gazette 2481/22 format from 1 July 2026 to 1 October 2026.

 | Reprieve on software cutover; underlying layout and field requirements remained unchanged.

 |
| **IRD Notice SEC/PN/VAT/2026-03**<br> | Issued 4 May 2026

 | Technical rollout of RAMIS Web API integration.

 | Mandates real-time streaming of Schedule 01 (output) and Schedule 04 (adjustments); auto-populates buyer Schedule 02.

 |
| **VAT (Amendment) Act No. 14 of 2026**<br> | Certified 30 June 2026

 | Reaffirms LKR 60M annual threshold; increases Financial Services VAT to 20.5%; mandates secured POS systems.

 | Establishes LKR 1,000,000 fine and 6 months imprisonment for non-compliance; expands addressable market to ~35,000 entities.

 |

### Core Regulatory Mechanics

* **Serial Numbering Architecture:** Numbers must adhere to `YYMMM_QQQQ_XXXXX` (maximum 40 characters, no spaces). `YY` is the two-digit year, `MMM` is the three-letter month, `QQQQ` is the branch code of the issuing legal entity (1 to 15 characters), and `XXXXX` is a continuous sequential number. Each branch of a legal entity keeps its own sequence. The sequence resets at the start of each calendar month.


* **Absolute Immutability:** RAMIS Web API records cannot be edited or deleted once ingested. Downward or upward adjustments require a formal Tax Credit Note or Tax Debit Note referencing the original clearance identifier.


* **Two-Way Schedule Interaction:** Supplier submissions under Schedule 01 automatically populate the recipient's Schedule 02 ledger in RAMIS e-Services. Buyers must review, reconcile, and approve records individually or in bulk batches of up to 5,000 records to claim input tax deductions.



---

## 3. Market Sizing & Mandated Sector Roadmap

### Market Sizing Breakdown

* **Total Addressable Market (TAM):** ~$42.0M – $52.5M annually. Represents ~34,769 to 35,000 registered corporate VAT taxpayers operating above the LKR 60 million annual turnover threshold (or LKR 15 million per quarter).


* **Serviceable Addressable Market (SAM):** ~$16.8M – $24.5M annually. Narrows to 7,000–8,750 enterprises operating formal ERP or mid-market accounting systems (SAP, IFS, Dynamics, NetSuite, Odoo) with transaction volumes that make manual web entry unviable.


* **Serviceable Obtainable Market (SOM):** ~$1.92M – $3.60M annually. Realistic capture of 800–1,200 mid-to-large enterprise accounts within 24 to 36 months, focusing on Phase 1 export early adopters and Phase 2 mid-market manufacturers.



### Prioritized Target Cohorts

1. **Colombo Tea Auction Brokers (Pilot Cohort — Live since May 2026):**
* *Target Group:* The 8 licensed broker houses at the Colombo Tea Auction (e.g., Forbes & Walker, John Keells PLC, Ceylon Tea Brokers, Asia Siyaka, Eastern Brokers).


* *Pain Point:* Handling high-velocity consignment sales on behalf of factory estates; reconciling broker commissions and producer credit notes directly into RAMIS.




2. **Apparel & Garment Manufacturers (Phase 1 Mandate — Live Q3 2026):**
* *Target Group:* Export garment manufacturing groups and export buying offices.


* *Pain Point:* Complex supply chains, removal of the Simplified VAT (SVAT) scheme, zero-rated export tracking (Schedule 07), and significant input VAT recovery demands under Schedule 02.




3. **FMCG & Wholesale Distributors (Phase 2 Cohort — End of 2026):**
* *Target Group:* Packaged consumer goods, food/beverage distributors, and pharmaceutical traders.


* *Pain Point:* Managing multi-branch depot serial numbers (`YYMMM_QQQQ_XXXXX`) without collisions; processing continuous delivery returns via automated Schedule 04 credit notes.




4. **Financial Services & Banking (Phase 2 Cohort):**
* *Target Group:* Banks, leasing companies, and finance institutions.


* *Pain Point:* Managing the increased 20.5% VAT rate on millions of monthly recurring statements; high-volume batch processing.




5. **Modern Retail & Hospitality (POS Fiscalization Phase — 2026/2027):**
* *Target Group:* Supermarkets, hotel chains, and retail franchises.


* *Pain Point:* Complying with the statutory mandate for CGIR-approved secured POS devices; requires offline buffering so checkout counters never pause during network latency.





---

## 4. Competitive Analysis & Strategic Positioning

| Competitor / Solution | Architecture & Scope | Strengths | Vulnerabilities & Gaps | Strategic Counter-Positioning |
| --- | --- | --- | --- | --- |
| **Link4 Sri Lanka** (`link4.co/lk`)

 | APAC enterprise cloud platform; Peppol Access Point; pre-built NetSuite/SAP connectors.

 | Enterprise certifications, global track record.

 | Expensive USD pricing tiers; lacks deep support for older on-premise ERPs; offshore ticketing.

 | Offer localized LKR pricing, support on-premise file watchers, and provide responsive local technical support. |
| **Effectz AI** (`einvoice.effectz.ai`)

 | SaaS e-invoicing web platform; serial generation; TIN checks.

 | Free entry tier, quick web onboarding, Gazette serial engine.

 | Primarily a web billing platform; unproven bidirectional ERP sync (Schedule 02 matching).

 | Position as an enterprise integration engine with two-way AP/AR matching, not just an invoice issuer.

 |
| **ERP-Embedded Layers** (Capricon, Cansas ERP)

 | Embedded modules within proprietary ERP platforms.

 | Bundled tax audits; deep native UI integration.

 | Tied to their proprietary ERPs; unavailable for companies on SAP, IFS, or Oracle.

 | Serve as the open, universal middleware that connects to any Tier-1 global ERP.

 |
| **Bespoke In-House Scripts** (Conglomerate IT)

 | Custom point-to-point scripts built by internal IT teams.

 | Full control; avoids software subscription fees.

 | Fragile; lacks asynchronous message queues; breaks on IRD schema changes; high maintenance.

 | Highlight operational risks and LKR 1M non-compliance penalties to justify an enterprise SLA.

 |

---

## 5. System Architecture & Technical Specifications

The middleware decouples core enterprise billing from the IRD gateway, combining an AWS serverless data pipeline with Supabase for operational analytics.

### Organization Structure

Every customer account has three levels. A single-office business is one organization, one legal entity, and one branch.

```text
Organization X                         subscription, users, invoice allowance
├── Legal Entity A                     own TIN, VAT, invoices, RAMIS submissions
│   ├── Branch CMB                     serial lane only (QQQQ)
│   └── Branch KDY
└── Legal Entity B
    └── Branch HO
```

* **Organization.** The commercial account. It holds one subscription, one monthly invoice allowance, and the user list. Invoices cleared by every legal entity count toward that allowance.
* **Legal entity.** A subsidiary that files VAT on its own. It holds its own TIN, VAT registration, field-mapping profile, invoices, credit notes, debit notes, and RAMIS submissions. Records stay inside that legal entity.
* **Branch.** A depot, warehouse, or sales channel inside one legal entity. It supplies the `QQQQ` segment of `YYMMM_QQQQ_XXXXX` and keeps that entity's monthly sequence separate. A single-office legal entity uses one branch, such as `HO`. Two branches of the same legal entity can both issue `00001` in the same month, for example `26OCT_CMB_00001` and `26OCT_KDY_00001`.

**Access** is one membership per person per organization. The host selects the organization. The membership role sets what that person can do inside it. Legal entities and branches are not permission boundaries. The roles and actions are defined in `docs/roles.md`.

| Role | What it can do |
| --- | --- |
| Owner | Everything in the organization, including billing and the subscription. |
| Admin | Users, RAMIS certificates, and field mapping, plus the Manager actions. |
| Manager | Schedule 02 approval and Schedule 04 authorization, plus the Staff actions. |
| Staff | Fix exceptions, re-queue invoices, and view every branch queue in the organization. |
| Viewer | Read the queue and the gap reports. |

| Capability | Owner | Admin | Manager | Staff | Viewer |
| --- | --- | --- | --- | --- | --- |
| Manage billing and subscription | Yes | No | No | No | No |
| Manage users and role assignment | Yes | Yes | No | No | No |
| RAMIS API and certificate setup | Yes | Yes | No | No | No |
| ERP ingestion and field mapping | Yes | Yes | No | No | No |
| Approve Schedule 02 bulk input credits | Yes | Yes | Yes | No | No |
| Authorize Schedule 04 credit and debit notes | Yes | Yes | Yes | No | No |
| Fix exceptions and re-queue invoices | Yes | Yes | Yes | Yes | No |
| Reprint cleared invoices and view the queue | Yes | Yes | Yes | Yes | Read-only |
| Audit logs and sequence gap reports | Yes | Yes | Yes | No | Read-only |

An Owner manages the subscription for the whole group. Every member sees every legal entity and every branch in that organization. The role decides which actions are allowed. A Viewer can open the queue and the gap reports and cannot approve, re-queue, or change setup.

A person who works for two customers has two memberships and uses two hosts. Supabase Row-Level Security keeps the browser key from reading tables. The portal checks the membership for the organization in the host, then checks the action.

### Architecture Data Flow

* **Step 1 (Ingestion):** The client ERP triggers an automated file export upon invoice posting, uploading the file via SFTP into the shared invoice bucket at `uploads/{organization_id}/{legal_entity_id}/{branch_id}/inbound/`. Alternatively, modern cloud ERPs post directly to an HTTPS Webhook (`POST /v1/invoices`) for one legal entity.
* **Step 2 (Buffering & Sequencing):** S3 triggers an event notification that routes a metadata message into an **Amazon SQS FIFO Queue**. The queue groups messages by `MessageGroupId = {legal_entity_id}:{branch_code}`, guaranteeing strict chronological processing and a separate serial sequence per branch of that legal entity.
* **Step 3 (Pre-Flight Validation & Formatting):** An **AWS Lambda Worker** reads from SQS FIFO and applies validation logic:
* Verifies 9-digit buyer and seller TINs.


* Validates separate Invoice Date and Supply Date fields.


* Calculates CBSL exchange rates for foreign-denominated invoices.


* Checks that line-item subtotals and 18% VAT sum accurately to the grand total.


* Assigns the sequential Gazette serial number (`YYMMM_QQQQ_XXXXX`).




* **Step 4 (Database Staging):** The Lambda worker records the transaction in **Supabase** against its legal entity and branch, with status `SUBMITTING` and a payload SHA-256 hash to enforce idempotency.
* **Step 5 (Gateway Dispatch):** The payload is transmitted to the RAMIS Web API (`ramis.webapi@ird.gov.lk`) over mutual TLS with a 15-second timeout.


* **Step 6 (Response Handling & Acknowledgment):**
* *On Success (HTTP 200/201):* Status is updated to `CLEARED` in Supabase; the RAMIS clearance token is archived; the file moves to `/uploads/{organization_id}/{legal_entity_id}/processed/`; an acknowledgment file is written to `/uploads/{organization_id}/{legal_entity_id}/acknowledgments/` for the ERP to ingest.
* *On Validation Failure (4xx):* Status is updated to `REJECTED`; the file moves to `/uploads/{organization_id}/{legal_entity_id}/rejected/`; a human-readable error log is generated for the billing desk.
* *On Gateway Outage (5xx/Timeout):* The worker retries using exponential backoff; persistent failures route to an **SQS Dead Letter Queue (DLQ)** with operational alerts triggered via Amazon EventBridge.


* **Step 7 (Inward Reconciliation & Analytics):** The admin portal reads Supabase for the organization in the host. Owner, Admin, and Manager can approve Schedule 02 records in bulk, up to 5,000 at a time. A Viewer can see the queue, clearance analytics, and gap reports and cannot approve. Staff cannot open audit logs or gap reports.



---

## 6. ERP Ingestion Strategies (Solving the ERP Side)

To integrate seamlessly across diverse ERPs, the middleware applies a two-gate strategy that isolates and processes only reportable transactions:

### Gate 1: ERP Configuration (Exporting Only Schedule 01 & 04)

ERP systems separate transactions by document type and tax classification. Configuring them to export only qualifying tax records is a standard administrative task:

* **SAP S/4HANA & ECC:** Configure Output Control (NACE/BRFplus) with Dispatch Time 4 ("Send immediately"). Trigger exports only for Billing Types `F2`/`FX` (Schedule 01 Tax Invoices) and `G2`/`L2` (Schedule 04 Credit/Debit Notes). Quotations, pro-formas, and internal transfers generate no export files.


* **SAP Business One:** In the Electronic Document Service (EDS), activate electronic export specifically for Object Type 13 (A/R Invoices) and Object Type 14 (A/R Credit Memos).


* **IFS Applications / IFS Cloud:** In IFS Connect, configure Outbound Routing Rules on the `CustomerOrderInvHead` table filtering by `INVOICE_TYPE = 'CUSTORDINV'` (Schedule 01) and `CUSTORDCRE'` (Schedule 04).


* **Microsoft Dynamics 365 Business Central:** Attach job queue exports exclusively to the Posted Sales Invoice and Posted Sales Credit Memo tables.



### Gate 2: Middleware-Side Parsing & Safety Net

* **Dynamic Field Mapper:** The middleware avoids rigid CSV templates by providing a graphical field mapper in the Admin Portal. During onboarding, each legal entity's sample export columns are mapped once (e.g., `Column[4] -> Buyer_TIN`) and saved as that legal entity's reusable profile.


* **Non-VAT File Disposal:** If an unneeded non-tax document reaches the SFTP bucket, Lambda flags it as `SKIPPED_NON_VAT`, logs the skip in Supabase, and bypasses the RAMIS Web API entirely, preventing accidental submission of invalid records.


* **Handling File-Write Races:** To avoid parsing half-written files, client ERPs upload files with a temporary extension (`.csv.tmp`) and rename to `.csv` upon completion. The S3 event filter listens strictly for `s3:ObjectCreated:Put` on `.csv` extensions.
* **Optional Windows Sync Agent:** For legacy on-premise accounting software that cannot establish outbound SFTP connections, provide a lightweight, pre-compiled Windows background service. The agent watches a local folder (e.g., `C:\ERP_Outbound\`) and uploads files to AWS over secure HTTPS.

---

## 7. Commercial Packaging & Pricing Strategy

Pricing is denominated in local currency (LKR) to eliminate foreign exchange exposure for clients, structured across transparent tiers:

| Metric / Feature | Tier 1: Standard | Tier 2: Professional *(Sweet Spot)* | Tier 3: Enterprise | Custom / Volume |
| --- | --- | --- | --- | --- |
| **Target Clients** | Single-entity trading, small tea brokers (Odoo, Business Central).

 | Mid-market manufacturing, FMCG, apparel exporters (SAP B1, IFS).

 | Conglomerates, large apparel groups (SAP S/4HANA, IFS). | Banks, leasing firms, retail supermarkets.

 |
| **Monthly Fee (LKR)** | LKR 10,000 / mo | LKR 75,000 / mo | LKR 175,000 / mo | Custom Quote |
| **Billing Frequency** | **Mandatory Annual** (LKR 120,000/yr upfront) | Annual or Semi-Annual (LKR 900,000/yr) | Annual (LKR 2,100,000/yr) | Annual Contract (LKR 3.5M – 5.0M+) |
| **One-Time Setup Fee** | LKR 50,000 – LKR 75,000 | LKR 250,000 | LKR 450,000 | Custom Scope |
| **Included Monthly Volume** | Up to 500 invoices/mo | Up to 5,000 invoices/mo | Up to 25,000 invoices/mo | 50,000+ invoices/mo |
| **Overage per Invoice** | LKR 10.00 / invoice | LKR 8.00 / invoice | LKR 5.00 / invoice | Custom Volume Rate |
| **Core Capabilities** | Outbound Schedule 01 Web API, Gazette serial engine.

 | Schedule 01 & 04, multi-branch, Schedule 02 inward matching.

 | SQS queueing, Power BI dashboards, dedicated exception desk, SLA. | Sub-second POS edge buffering.

 |
| **Support Model** | Email / Ticketing only | Standard Business Support | Priority 24/7 Hotline & SLA | Dedicated Technical Account Manager |

### Subscription Scope

The subscription belongs to the organization. The monthly fee, included invoice volume, and overage are calculated once for that organization. Invoices cleared by all of its legal entities count toward the same allowance. A legal entity is not billed on its own, and a branch has no subscription.

A single-entity customer is stored as one organization, one legal entity, and one branch. A group is one organization with a legal entity for each VAT-registered subsidiary.

### CFO ROI Justification

* **Lower than Clerical Headcount:** Manually preparing, verifying, and uploading VAT schedules on the RAMIS portal requires a junior accounts executive (costing LKR 65,000–85,000/month in Colombo). Tier 2 middleware costs LKR 75,000/month while eliminating human error.


* **Lower than Non-Compliance Fines:** The amended VAT Act imposes maximum fines of LKR 1,000,000 and up to six months imprisonment for non-compliance or submitting inaccurate invoices. A year of Tier 2 software protection costs less than a single penalty.


* **Guaranteed Input Tax Recovery:** Inward matching (Schedule 02) reconciles 18% VAT credits on millions of rupees in purchases, preventing disallowed tax claims caused by supplier non-filing.



---

## 8. Go-to-Market, Partnerships & Sales Execution

### Strategic Channel Partnerships

#### 1. ERP Implementation Partners (Primary Scale Channel)

Local System Integrators (SIs) manage relationships with hundreds of mid-market and enterprise businesses. Building custom API scripts for each client strains their engineering teams.

* **PBSS Group (Perfect Business Solution Services):** Top SAP Gold Partner with 350+ implementations, heavily focused on mid-market SAP Business One.
* **Pristine Solutions:** Pioneer SAP partner with deep penetration in tea plantations and agriculture via their specialized "Tea One" vertical.
* **John Keells IT (JKIT):** Enterprise SAP Gold Partner managing large conglomerate, manufacturing, and retail accounts.
* **Tech Pacific Lanka:** SAP Gold Partner with major enterprise accounts across automotive, engineering, and supply chains.
* **Rizing / attune:** SAP Gold Partner specializing in SAP Fashion and apparel supply chains (core of Phase 1).


* **The Pitch to SIs:** *"We provide Invoz, a certified, maintained engine for the government RAMIS Web API. Your team delivers the billable ERP export mapping, pockets 50% to 70% of the initial setup fee, and earns a 20% to 25% recurring margin on the annual SaaS subscription for every client."*

#### 2. Accounting BPOs & Tax Consultancies

* **Auditor Independence Restrictions:** Top-tier audit firms are legally barred by CA Sri Lanka independence rules from reselling accounting software to their statutory audit clients.
* **The Strategy:** Partner with dedicated **Tax Advisory practices, mid-tier accounting firms, and Accounting BPOs**. Grant each adviser one membership on the client organization, with one of the five portal roles, so they can monitor compliance, resolve exceptions, and, where the role allows, run bulk 5,000-record Schedule 02 approvals.



### Targeted Lead Generation & Cold Outreach

1. **Phase 1 Export Outreach:** Focus directly on the 8 licensed Colombo Tea Auction brokers and garment exporters from the Joint Apparel Association Forum (JAAF) member directory.


2. **Account Intelligence via Public Filings:**
* Review annual reports of listed firms on the Colombo Stock Exchange (`cse.lk`) to extract the direct names of CFOs, Heads of Tax, and Financial Controllers.
* Access the Sri Lanka Export Development Board (EDB) online directory to identify large export manufacturers and IT heads.


3. **The "Invoz Diagnostic" Lead Magnet:**
* Avoid cold pitches offering "VAT consultation on commission," which face regulatory restrictions and CFO skepticism.


* Instead, offer a 3-day **"Invoz diagnostic."** The client provides a sample billing export; your validation engine runs pre-flight checks and generates a 2-page gap report highlighting defective fields under Gazette 2481/22 (e.g., malformed serial numbers, missing supply dates, unrounded VAT math).


* Convert the audit into a software sale: *"We will credit 100% of the diagnostic fee toward your Invoz implementation."*



---

## 9. Phased 12-Week Execution Roadmap

### Phase 1: Specifications & IRD Sandbox (Weeks 1–2)

* Submit an official request to `ramis.webapi@ird.gov.lk` for the RAMIS Web API OpenAPI/Swagger specification, authentication requirements (mutual TLS/OAuth), and staging credentials.


* Acquire Gazette Extraordinary No. 2481/22 and IRD Public Notice SEC/PN/VAT/2026-03.


* Finalize the comprehensive field-mapping dictionary connecting standard invoice fields to Schedule 01 and Schedule 04 payloads.



### Phase 2: Core Engine & Sandbox Validation (Weeks 3–6)

* Build the stateful Gazette serial numbering engine (`YYMMM_QQQQ_XXXXX`) with automated monthly resets. Each sequence belongs to one branch of one legal entity.


* Build the pre-flight syntax validation library (validating 9-digit TINs, separate supply dates, CBSL currency conversions, and line math).


* Deploy an AWS Lambda worker to test transmission of synthetic invoices and credit notes to the IRD sandbox endpoint until consistent HTTP 200/201 clearances are achieved.



### Phase 3: Ingestion Pipeline & Admin Portal (Weeks 7–9)

* Configure the serverless data pipeline: AWS Transfer Family SFTP $\rightarrow$ S3 bucket $\rightarrow$ SQS FIFO queue $\rightarrow$ Lambda worker.
* Set up the return path under each branch (`/uploads/{organization_id}/{legal_entity_id}/{branch_id}/inbound`, `processed`, `rejected`, `acknowledgments`).
* Build the organization, legal-entity, and branch model, and one membership per user per organization with the five portal roles (Owner, Admin, Manager, Staff, Viewer).
* Build the dynamic field mapper and reconciliation portal using Supabase (PostgreSQL with Row-Level Security) and a responsive frontend dashboard.
* Build the automated Schedule 02 inward polling and bulk 5,000-record approval interface.



### Phase 4: Pilot Deployment & Partner Rollout (Weeks 10–12)

* Secure two non-paying pilot clients: one Colombo Tea Auction broker house and one mid-sized apparel exporter.


* Deploy the integration via standard SFTP file drop and validate real-time transaction clearing through the live RAMIS Web API.


* Package the pilot success into an executive case study.
* Conduct technical walkthroughs with key ERP integrators (PBSS, Pristine) to sign reseller agreements and initiate channel distribution.