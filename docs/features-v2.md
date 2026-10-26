To present your multi-tenant platform not merely as a government API pipeline, but as an indispensable **Tax Operations & Working Capital Platform**, the software must solve two distinct problems:

1. **Statutory Compliance (Must-Haves):** Guaranteeing zero rejections, strict formatting, and immunity from the Inland Revenue Department's (IRD) statutory penalties.


2. **Enterprise Financial Intelligence (Nice-to-Haves / Value-Adds):** Protecting input tax credits, automating reconciliation, accelerating audit defense, and giving Chief Financial Officers (CFOs) and external tax advisors complete visibility over company tax positions.



Below is the comprehensive enterprise feature catalog structured for a premium light-theme dashboard.

---

### Part 1: "Must-Have" Features (Statutory Compliance & Operational Survival)

These features represent the non-negotiable legal and technical baseline required by Gazette Extraordinary No. 2481/22, Gazette No. 2500/106, and IRD Notice SEC/PN/VAT/2026-03. Without these, the application cannot function as a compliant e-invoicing bridge.

```
┌────────────────────────────────────────────────────────────────────────┐
│                          MUST-HAVE MODULES                             │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Gazette 2481/22 Sequential Engine    4. Pre-Flight Validation Gate  │
│ 2. RAMIS Schedule 01 Outbound Streaming 5. Inward Schedule 02 Sync     │
│ 3. Schedule 04 Immutability & Notes    6. Multi-Branch QQQQ Governance│
└────────────────────────────────────────────────────────────────────────┘

```

#### 1. Statutory Gazette 2481/22 Numbering & Formatting Engine

* **Dynamic Gapless Sequence Generator:** Generates compliant invoice serials formatted as `YYMMM_QQQQ_XXXXX` (maximum 40 alphanumeric characters, no spaces).


* **Automated Monthly Rollover:** Automatically advances the `YYMMM` prefix at 00:00:00 on the first day of each calendar month (e.g., transitioning from `26OCT` to `26NOV`) while managing isolated sequential counters per branch.


* **Statutory Content Validator:** Enforces the mandatory presence of:
* 9-digit Taxpayer Identification Number (TIN) for both supplier and purchaser.


* Registered business names and registered addresses matching the official VAT certificate.


* Distinct dual dates: **Invoice Date** (date of issue) and **Date of Supply** (date ownership transfers).


* Three-line VAT value ladder: Value excluding VAT, VAT amount (calculated at 18% standard or 20.5% financial services), and total consideration.




* **CBSL Exchange Rate Converter:** Automatically checks and applies official Central Bank of Sri Lanka (CBSL) daily selling rates on foreign-currency invoices to validate mandatory LKR equivalent values.



#### 2. RAMIS Outbound Clearance Gateway (Schedule 01)

* **Real-Time Web API Streaming:** Serializes ERP transaction payloads into the official IRD JSON schema and transmits them to `ramis.webapi@ird.gov.lk`.


* **Multi-Schedule Classification:** Accurately routes supplies to their respective statutory buckets under Schedule 01:
* Standard Supplies (18% VAT).


* Financial Services Supplies (20.5% VAT).


* Zero-Rated Export Supplies (0% VAT / Schedule 07).


* Exempt Supplies (First Schedule of the VAT Act).




* **Token Archival & QR Generation:** Captures the unique RAMIS Clearance Token upon HTTP 201 approval, stores the timestamped receipt, and generates verified verification URLs for PDF/printed invoices.



#### 3. Transaction Immutability & Adjustment Engine (Schedule 04)

* **Immutability Enforcement:** Hard-locks cleared invoices against edits or deletions in accordance with IRD regulations.


* **Schedule 04 Credit & Debit Note Generator:** If an ERP user cancels or adjusts a posted bill, the engine prevents direct deletion; instead, it automatically formats and transmits a linked **Tax Credit Note** (downward adjustment) or **Tax Debit Note** (upward adjustment).


* **Mandatory Parent Linking:** Automatically attaches the original invoice serial number, original invoice date, and structured adjustment reasons to every credit/debit payload.



#### 4. Pre-Flight Validation & Error Prevention Gate

* **Mathematical Reconciliation:** Validates that line-item subtotals, tax rate applications, and line totals round cleanly to two decimal places in LKR before sending data to the tax authority.


* **TIN Pre-Check:** Flags invalid, short, or missing customer TINs before transmission to prevent immediate 422 RAMIS rejections.


* **Supply Date Sequence Check:** Ensures the Date of Supply is logical relative to the Invoice Date (preventing future-dated supply anomalies).



#### 5. Inward Schedule 02 Synchronizer & Bulk Approval

* **Automated Inward Polling:** Regularly pulls supplier-cleared invoices from RAMIS e-Services that name the client’s 9-digit TIN.


* **Statutory Bulk Approval Console:** Empowers finance managers to review inward supplier bills and execute approvals in **bulk batches of up to 5,000 records at once**, updating their status to "Matched" to secure deductible input tax credits.



#### 6. Multi-Tenant Branch (`QQQQ`) Isolation

* **Branch-Level Partitioning:** Isolates sequential counters (`XXXXX`) by physical factory, depot, or branch code (`QQQQ`) under each legal entity (TIN).


* **Concurrency Locking:** Atomic database sequence counters ensure that high-volume simultaneous invoice postings across branches never produce duplicate serial numbers or gaps.



---

### Part 2: "Nice-to-Have" & Enterprise Value-Add Features (The Platform Beyond Compliance)

These features transform your application from a standard utility into a strategic SaaS platform that Chief Financial Officers (CFOs), Heads of Tax, and external audit firms will champion.

```
┌────────────────────────────────────────────────────────────────────────┐
│                          VALUE-ADD MODULES                             │
├────────────────────────────────────────────────────────────────────────┤
│ 1. 2-Way AP Matching Engine             4. Audit Defense & Gap Auditor │
│ 2. Executive CFO Tax Analytics          5. Dynamic Field-Mapping Studio│
│ 3. Tax Consultant Multi-Client Hub      6. POS Edge Buffer & Sync      │
└────────────────────────────────────────────────────────────────────────┘

```

#### 1. Automated Two-Way AP Reconciliation Engine (The "MaxITC" Module)

* **Automated Ledger Matching:** Automatically compares inward vendor records pulled from RAMIS Schedule 02 against internal ERP Accounts Payable (AP) vouchers and Goods Received Notes (GRN).


* **Discrepancy Detection & Categorization:**
* *Unreported by Supplier:* Supplier charged 18% VAT on paper/PDF, but failed to transmit to RAMIS (unclaimed input tax credit risk).


* *Mathematical Discrepancy:* Supplier billed LKR 100,000 in ERP, but reported LKR 90,000 to RAMIS.


* *Timing Mismatch:* Supplier reported in a different taxable quarter.




* **Vendor Dispute & Communication Center:** One-click generation of automated discrepancy notices emailed directly to non-compliant vendors: "Your invoice #INV-1092 has not been submitted to RAMIS. Our 18% VAT input deduction is blocked; please clear this record immediately."



#### 2. Executive CFO & Tax Analytics Dashboard

* **Real-Time Net VAT Exposure:** Live calculation of estimated net VAT payable for the current period ($Net = Schedule\ 01\ Output - Schedule\ 02\ Input - Schedule\ 04\ Adjustments$).


* **Cash Outflow Forecasting:** Projects the cash settlement required by the 20th of the following month based on current billing trends.


* **Credit Note Health Ratio:** Tracks the ratio of Credit Notes (Schedule 04) to Gross Sales (Schedule 01). An elevated ratio (>5%) triggers warnings of operational inefficiencies or potential audit scrutiny.


* **Tax Rate Shift Monitor:** Visual tracking of standard 18% supplies versus 20.5% financial services supplies and zero-rated exports.



#### 3. Tax Consultant & Accounting BPO Multi-Client Hub

* **Multi-Client Switcher:** Allows external chartered accountants and tax advisory firms to manage 20 to 50 distinct corporate client entities (TINs) from a single master dashboard.
* **Consolidated Compliance Health Scorecard:** Shows an overview of all client accounts, displaying:
* On-time filing probability.


* Unmatched Schedule 02 input credits.


* Unresolved pre-flight exception counts.




* **One-Click Return Pack Exporter:** Compiles verified transactions into pre-formatted, audit-ready Excel and PDF schedule packs mirroring IRD return requirements.



#### 4. Audit Defense & Gazette Sequence Auditor

* **Automated Gap-Detection Auditor:** A dedicated forensic tool that scans all `YYMMM_QQQQ_XXXXX` numbers across all branches, confirming continuous numeric sequences without missing values.


* **One-Click Audit Defense Report:** Generates an official, certified PDF statement proving sequence continuity to IRD tax auditors.


* **Immutable Change Log (8-Year Audit Trail):** Maintains an encrypted, tamper-evident log containing the raw ERP payload, validation timestamps, mTLS handshake logs, and RAMIS acknowledgment tokens for 8 years (exceeding statutory record-keeping rules).



#### 5. Dynamic ERP Field-Mapping Studio & Ingestion Monitor

* **Visual Drag-and-Drop Column Mapper:** Allows IT administrators to upload a sample CSV or XML export from any ERP (SAP, IFS, Dynamics, Odoo) and visually map columns to the required RAMIS schema without writing code.


* **Automated SFTP / S3 Health Monitor:** Real-time visual status of folder directories (`/inbound`, `/processed`, `/rejected`, `/acknowledgments`), file arrival logs, and processing latency graphs.


* **Idempotency Protection:** Detects if an ERP accidentally re-uploads an identical billing file, flagging it as a duplicate and skipping it to avoid double-taxation liabilities.



#### 6. Retail Point of Sale (POS) Edge Monitor

* **Edge Terminal Heartbeat:** Monitors the connection status and sync state of counter-level POS terminals across retail store networks.


* **Offline Buffer Queue Tracker:** Shows real-time counts of transactions buffered locally at checkout counters during network outages, confirming background sync once connectivity recovers.



---

### Part 3: Dashboard Layout, Filtering & UX Blueprint

A high-density layout using your modern light palette provides the clarity enterprise accounting teams need.

#### 1. Global Filter Bar (Present Across All Modules)

Every view in the portal includes a unified, sticky top filter bar:

* **Legal Entity Picker:** Multi-TIN dropdown for conglomerate groups (`All Entities` or `Filter by TIN: 104829102`).


* **Branch Selector:** Filter by Gazette `QQQQ` code (`All Branches`, `HQ01`, `Depot-North`, `Factory-Biyagama`).


* **Taxable Period:** Year/Month selector (`2026-OCT`, `2026-NOV`, or Custom Date Range).


* **Schedule Filter:** Tab selector (`Schedule 01 Sales`, `Schedule 02 Purchases`, `Schedule 04 Adjustments`).


* **Transaction Status:** Pill toggles (`All`, `Cleared`, `Queued`, `Exceptions / Rejected`).



---

#### 2. Screen-by-Screen UX Layout

##### Screen A: Operational Overview Dashboard

* **Top Metric Ribbon (4 Key Cards):**
* *Card 1 (Net VAT Position):* Total Output Tax (LKR) vs. Validated Input Credit (LKR) = Net Estimated Payable.


* *Card 2 (Clearance Success Rate):* Percentage pill (e.g., `99.8% Cleared`) with in-flight queue counter.


* *Card 3 (Input VAT at Risk):* Total LKR amount of supplier invoices in Schedule 02 currently unmatched or unapproved.


* *Card 4 (Active Exceptions):* Count of rejected outbound invoices requiring billing desk attention.




* **Main Data Visualization:**
* Area chart showing daily cleared transaction volume over the active month against IRD gateway response latency (ms).




* **Bottom Split View:**
* *Left:* Live stream of recent RAMIS clearances (Serial number, Buyer TIN, Total LKR, Timestamp, Token badge).


* *Right:* Real-time SQS Queue health and IRD gateway status indicator (Green / Degraded / Offline).





##### Screen B: The Exception & Rejection Desk

* Dedicated workspace for Accounts Receivable (AR) clerks to resolve data errors before re-submitting:


* Displays table of rejected transactions with filterable error tags:
* `INVALID_TIN_FORMAT` (TIN not 9 digits).


* `MISSING_SUPPLY_DATE` (Date of supply omitted).


* `MATH_RECONCILIATION_FAIL` (Subtotal + VAT $\neq$ Total).


* `DUPLICATE_SERIAL` (Gazette serial collision).




* Clicking a row opens a slide-over panel displaying the raw ERP source row side-by-side with the validation failure, allowing quick corrections and one-click re-queueing.



##### Screen C: Schedule 02 Inward Reconciliation Workspace

* Split-grid workspace for Accounts Payable (AP) teams:


* *Left Pane (RAMIS Inward Feed):* Vendor TIN, Supplier Name, Gazette Invoice Serial, Value, VAT Amount.


* *Right Pane (ERP Internal AP Ledger):* Matched ERP Voucher, PO Number, GRN Date, GL Tax Code.




* Status indicators: `Matched (100%)`, `Discrepancy (Value Mismatch)`, or `Unmatched (Missing in ERP)`.
* Action toolbar: Includes the statutory **Bulk Approve Selected (Max 5,000)** button to commit deductions to RAMIS in a single transaction.



---

### Part 4: Comprehensive Feature Matrix

| Feature Module | Functional Capability | Must-Have | Nice-to-Have | Primary Target User |
| --- | --- | --- | --- | --- |
| **Gazette 2481/22 Engine** | Dynamic `YYMMM_QQQQ_XXXXX` serial generation

 | **Yes** | — | Billing Staff / System

 |
| **Gazette 2481/22 Engine** | Dual date enforcement (Invoice vs. Supply date)

 | **Yes** | — | Billing Staff / Pre-Flight

 |
| **Gazette 2481/22 Engine** | CBSL daily selling rate verification for foreign currency

 | **Yes** | — | Export Finance Team

 |
| **RAMIS Gateway** | Real-time Schedule 01 outbound Web API streaming

 | **Yes** | — | System Pipeline

 |
| **RAMIS Gateway** | Schedule 04 Credit & Debit Note immutability linking

 | **Yes** | — | Finance Manager / AR

 |
| **RAMIS Gateway** | Clearance token capture and QR verification payload generation

 | **Yes** | — | Dispatch / Billing Desk

 |
| **Validation Layer** | Pre-flight syntax, 9-digit TIN, and math verification

 | **Yes** | — | System Pipeline

 |
| **Validation Layer** | Non-VAT internal document skipping & filtering

 | **Yes** | — | IT Integration Lead

 |
| **Tenant Governance** | Multi-branch `QQQQ` serial isolation and atomic locking

 | **Yes** | — | System Admin

 |
| **Inward Compliance** | Schedule 02 inward record fetching from RAMIS

 | **Yes** | — | AP Accountant

 |
| **Inward Compliance** | Statutory bulk approval for up to 5,000 records at once

 | **Yes** | — | Finance Manager

 |
| **Exception Desk** | Visual error resolution and manual re-queueing interface

 | **Yes** | — | Billing Supervisor

 |
| **AP Reconciliation** | 2-Way automated matching (RAMIS Schedule 02 vs. ERP AP/GRN)

 | — | **Yes** | AP Team / Controller

 |
| **AP Reconciliation** | Vendor non-compliance discrepancy alerts and email generator

 | — | **Yes** | Procurement / AP Lead

 |
| **CFO Analytics** | Live Net VAT liability forecasting and outflow projections

 | — | **Yes** | Chief Financial Officer

 |
| **CFO Analytics** | Credit Note to Sales health ratio monitor

 | — | **Yes** | Financial Controller

 |
| **Consultant Hub** | Multi-TIN client management console with bulk health scores | — | **Yes** | External Tax Advisor / BPO |
| **Consultant Hub** | One-click export of verified IRD return schedule packs

 | — | **Yes** | Tax Accountant

 |
| **Audit Center** | Automated Gazette serial gap-detection report

 | — | **Yes** | Internal / External Auditor

 |
| **Audit Center** | Immutable 8-year encrypted audit trail with payload hash verification

 | — | **Yes** | Compliance Officer

 |
| **Integration Studio** | Visual drag-and-drop ERP column mapping engine

 | — | **Yes** | ERP Consultant / IT Lead

 |
| **Integration Studio** | Automated SFTP directory health monitor and retry dashboards

 | — | **Yes** | IT Infrastructure Team

 |
| **Retail Fiscalization** | POS terminal heartbeat and offline buffer sync tracker

 | — | **Yes** | Retail Operations Lead

 |

---

### Part 5: Executive Pitch Framing

When presenting this catalog to enterprise clients:

* **Pitching the CFO:** Focus on **Schedule 02 Inward Reconciliation** and the **CFO Analytics Dashboard**. Frame the software as an investment that prevents lost input tax deductions, provides clear cash outflow visibility, and eliminates the risk of LKR 1,000,000 statutory penalties.


* **Pitching the IT Director / CIO:** Focus on the **Pre-Flight Validation Gate**, **Asynchronous Queueing**, and **Dynamic Field-Mapping Studio**. Emphasize that your solution requires zero invasive code modifications inside their ERP, abstracts changing IRD API schemas, and guarantees billing desks never freeze during government gateway downtime.


* **Pitching the External Tax Advisor:** Focus on the **Tax Consultant Multi-Client Hub** and **Audit Defense Suite**. Show them how the platform reduces 40 hours of manual spreadsheet compilation to a single click, allowing them to service more corporate clients with complete audit confidence.
