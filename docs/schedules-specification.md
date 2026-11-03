# RAMIS Web API VAT Invoice Schedules Specification

**Regulatory Authority:** Inland Revenue Department (IRD) Sri Lanka  
**Source Document:** Notice No. SEC/PN/VAT/2026-03 (04.05.2026)  
**Communication Channel:** `ramis.webapi@ird.gov.lk`

---

## 1. Outbound Schedules (Transmitted via Middleware to Web API)

These schedules are automatically transmitted from the taxpayer's ERP/POS system to RAMIS in real time. Once transmitted successfully via the Web API, suppliers are **not required** to re-upload them via CSV or RAMIS e-Services.

### Schedule 01: Output Tax
* **Coverage:** Standard-rated taxable sales and exempted supplies.
* **Trigger:** Generation of a final sales invoice in the taxpayer's ERP/billing system.
* **Payload Requirements:**
  * Supplier TIN (9 digits) & Registered Trading Name.
  * Purchaser TIN (mandatory for B2B; consumer flag for B2C).
  * Unique Invoice Number & Invoice Date.
  * Date of Supply.
  * Itemized breakdown of goods/services.
  * Taxable value, applied VAT rate (e.g., 18%), and calculated VAT amount.
  * Clear flag for exempted supplies (where applicable).

### Schedule 04: Credit Notes & Debit Notes
* **Coverage:** Upward or downward adjustments to previously transmitted tax invoices.
* **Immutability Rule:** Records submitted via Web API cannot be directly amended or deleted. Any tax overstated or understated must be adjusted strictly through Schedule 04.
* **Payload Requirements:**
  * Original Invoice Reference Number & Original Invoice Date.
  * Credit/Debit Note Serial Number & Issue Date.
  * Reason for adjustment (returns, discount, price change, volume rebate).
  * Adjusted value and adjusted VAT amount.

### Schedule 07: Zero-Rated Supplies
* **Coverage:** Supplies taxable at a 0% rate (specifically direct export of goods, qualifying export of IT/digital services, and authorized supplies under special concessionary schemes).
* **Payload Requirements:**
  * Exporter TIN and Overseas Customer details.
  * Zero-rated supply invoice reference and supply date.
  * Foreign currency code, invoice value, exchange rate, and equivalent LKR value.
  * Reference linkage to export documents (e.g., CUSDEC number, export bill, inward foreign remittance bank reference).

---

## 2. Inbound & Auto-Populated Schedules (Reconciliation & Clearance)

These schedules are handled downstream within RAMIS and linked directly to supplier submissions:

### Schedule 02: Input Tax (Purchases)
* **Pre-Population Mechanism:** When a supplier submits Schedule 01 and Schedule 04 via the Web API, the data is automatically populated into the respective buyer's **Schedule 02** in RAMIS e-Services.
* **Taxpayer Action Required:**
  * Purchasers must review and approve these invoice records before claiming input tax.
  * RAMIS supports approval individually or in bulk (up to **5,000 records at once**).
  * Once approved, the record status transitions to **"Matched"**.
* **Unregistered / Non-API Suppliers:** Purchases from suppliers not connected to the Web API must still be manually uploaded via Excel/CSV or the RAMIS Schedule Record Submission interface.

### Schedules 03 & 06: Customs Pre-Population
* **Schedule 03 (Import VAT):** Automatically populated inside RAMIS using data fed directly from Sri Lanka Customs (ASYCUDA).
* **Schedule 06 (Export Clearances):** Automatically verified and populated via direct data sync with Sri Lanka Customs export CUSDEC clearances.

---

## 3. Fallback & Exception Handling Rules

* **Transmission Failure:** If any schedule record fails to transmit through the Web API (e.g., server timeout or connectivity failure), the middleware must store the failed records for retry. As an official fallback, the IRD permits these failed records to be submitted via CSV upload on the RAMIS portal.
* **Audit Trail:** Transmitted records become legal declarations immediately upon API acknowledgment; client adjustments must follow the Schedule 04 workflow.