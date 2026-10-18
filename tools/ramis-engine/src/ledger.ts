import { randomBytes } from "node:crypto";
import { Code, RamisError } from "./errors";
import { fromCents } from "./money";
import type { NormalizedAdjustment, NormalizedInvoice } from "./validation";

export type ClearanceResponse = {
  status: "CLEARED";
  ramis_clearance_token: string;
  serial_number: string;
  supplier_tin: string;
  purchaser_tin: string;
  cleared_timestamp: string;
  qr_payload: string;
  warnings: string[];
};

export type AdjustmentResponse = {
  status: "CLEARED";
  ramis_adjustment_token: string;
  adjustment_serial_number: string;
  original_invoice_serial_number: string;
  cleared_timestamp: string;
};

export type PurchaseRecord = {
  ramis_record_id: string;
  supplier_tin: string;
  supplier_name: string;
  supplier_invoice_serial: string;
  invoice_date: string;
  supply_date: string;
  value_excluding_vat: number;
  vat_amount: number;
  total_consideration: number;
  submission_timestamp: string;
  approval_status: "PENDING_REVIEW" | "MATCHED";
};

export type ApprovalResult = {
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  records_approved: number;
  records_failed: number;
  status_updated_to: "Matched";
  approval_batch_reference: string;
  failures?: { record_id: string; message: string }[];
};

type InvoiceRecord = {
  serialNumber: string;
  hash: string;
  supplierTin: string;
  supplierName: string;
  purchaserTin: string;
  purchaserName: string;
  invoiceDate: string;
  supplyDate: string;
  netCents: number;
  vatCents: number;
  totalCents: number;
  vatRateBasisPoints: number;
  recordId: string;
  approvalStatus: "PENDING_REVIEW" | "MATCHED";
  remainingVatCents: number;
  clearedAt: string;
  response: ClearanceResponse;
};

type AdjustmentRecord = {
  serialNumber: string;
  hash: string;
  response: AdjustmentResponse;
};

type IdempotencyHit = {
  hash: string;
  response: ClearanceResponse | AdjustmentResponse;
};

export class Ledger {
  private readonly invoices = new Map<string, InvoiceRecord>();
  private readonly adjustments = new Map<string, AdjustmentRecord>();
  private readonly records = new Map<string, InvoiceRecord>();
  private readonly idempotency = new Map<string, IdempotencyHit>();
  private nextRecord = 8_849_201;
  private nextBatch = 88_310;

  get invoiceCount(): number {
    return this.invoices.size;
  }

  get adjustmentCount(): number {
    return this.adjustments.size;
  }

  reset(): void {
    this.invoices.clear();
    this.adjustments.clear();
    this.records.clear();
    this.idempotency.clear();
    this.nextRecord = 8_849_201;
    this.nextBatch = 88_310;
  }

  clearInvoice(invoice: NormalizedInvoice, idempotencyKey: string): ClearanceResponse {
    const replay = this.takeReplay<ClearanceResponse>("invoice", invoice.supplier.tin, idempotencyKey, invoice.hash);
    if (replay) return replay;

    const existing = this.invoices.get(invoice.serialNumber);
    if (existing) {
      if (existing.hash === invoice.hash) {
        this.remember("invoice", invoice.supplier.tin, idempotencyKey, invoice.hash, existing.response);
        return existing.response;
      }
      throw new RamisError(409, Code.IMMUTABLE, immutableInvoice(invoice.serialNumber), "header.serial_number");
    }

    const clearedAt = timestamp();
    const token = clearanceToken("RAMIS-CLR", clearedAt);
    const response: ClearanceResponse = {
      status: "CLEARED",
      ramis_clearance_token: token,
      serial_number: invoice.serialNumber,
      supplier_tin: invoice.supplier.tin,
      purchaser_tin: invoice.purchaser.tin,
      cleared_timestamp: clearedAt,
      qr_payload: `https://ramis.ird.gov.lk/verify?tin=${invoice.supplier.tin}&sn=${encodeURIComponent(invoice.serialNumber)}&tok=${encodeURIComponent(token)}`,
      warnings: invoice.warnings,
    };
    const record: InvoiceRecord = {
      serialNumber: invoice.serialNumber,
      hash: invoice.hash,
      supplierTin: invoice.supplier.tin,
      supplierName: invoice.supplier.name,
      purchaserTin: invoice.purchaser.tin,
      purchaserName: invoice.purchaser.name,
      invoiceDate: invoice.invoiceDate,
      supplyDate: invoice.supplyDate,
      netCents: invoice.netCents,
      vatCents: invoice.vatCents,
      totalCents: invoice.totalCents,
      vatRateBasisPoints: invoice.vatRateBasisPoints,
      recordId: `REC-${this.nextRecord++}`,
      approvalStatus: "PENDING_REVIEW",
      remainingVatCents: invoice.vatCents,
      clearedAt,
      response,
    };
    this.invoices.set(record.serialNumber, record);
    this.records.set(record.recordId, record);
    this.remember("invoice", invoice.supplier.tin, idempotencyKey, invoice.hash, response);
    return response;
  }

  clearAdjustment(adjustment: NormalizedAdjustment, idempotencyKey: string): AdjustmentResponse {
    const replay = this.takeReplay<AdjustmentResponse>(
      "adjustment",
      adjustment.supplier.tin,
      idempotencyKey,
      adjustment.hash,
    );
    if (replay) return replay;

    const existing = this.adjustments.get(adjustment.serialNumber);
    if (existing) {
      if (existing.hash === adjustment.hash) {
        this.remember("adjustment", adjustment.supplier.tin, idempotencyKey, adjustment.hash, existing.response);
        return existing.response;
      }
      throw new RamisError(
        409,
        Code.IMMUTABLE,
        `Adjustment '${adjustment.serialNumber}' has already been cleared. RAMIS records are immutable and cannot be modified.`,
        "header.adjustment_serial_number",
      );
    }

    const invoice = this.invoices.get(adjustment.originalSerialNumber);
    if (!invoice) {
      throw new RamisError(
        404,
        Code.PARENT,
        `Original invoice '${adjustment.originalSerialNumber}' was never cleared`,
        "header.original_invoice_serial_number",
      );
    }
    if (adjustment.supplier.tin !== invoice.supplierTin || adjustment.purchaser.tin !== invoice.purchaserTin) {
      throw new RamisError(
        422,
        Code.PARENT,
        `Adjustment parties do not match cleared invoice '${invoice.serialNumber}'`,
        "supplier.tin",
      );
    }
    if (adjustment.originalInvoiceDate !== invoice.invoiceDate) {
      throw new RamisError(
        422,
        Code.PARENT,
        `original_invoice_date does not match cleared invoice '${invoice.serialNumber}' (${invoice.invoiceDate})`,
        "header.original_invoice_date",
      );
    }
    if (adjustment.vatRateBasisPoints !== invoice.vatRateBasisPoints) {
      throw new RamisError(
        422,
        Code.MATH,
        "Adjustment VAT rate does not match the cleared invoice",
        "adjustment_values.vat_rate",
      );
    }
    if (adjustment.adjustmentType === "TAX_CREDIT_NOTE" && adjustment.vatCents > invoice.remainingVatCents) {
      throw new RamisError(
        422,
        Code.CREDIT_LIMIT,
        `Credit note VAT ${fromCents(adjustment.vatCents).toFixed(2)} exceeds the unadjusted VAT remaining on invoice '${invoice.serialNumber}' (${fromCents(invoice.remainingVatCents).toFixed(2)})`,
        "adjustment_values.adjusted_vat_amount",
      );
    }

    if (adjustment.adjustmentType === "TAX_CREDIT_NOTE") {
      invoice.remainingVatCents -= adjustment.vatCents;
    } else {
      invoice.remainingVatCents += adjustment.vatCents;
    }

    const clearedAt = timestamp();
    const response: AdjustmentResponse = {
      status: "CLEARED",
      ramis_adjustment_token: clearanceToken("RAMIS-ADJ", clearedAt),
      adjustment_serial_number: adjustment.serialNumber,
      original_invoice_serial_number: adjustment.originalSerialNumber,
      cleared_timestamp: clearedAt,
    };
    this.adjustments.set(adjustment.serialNumber, { serialNumber: adjustment.serialNumber, hash: adjustment.hash, response });
    this.remember("adjustment", adjustment.supplier.tin, idempotencyKey, adjustment.hash, response);
    return response;
  }

  purchases(
    buyerTin: string,
    taxPeriod: string,
    status: "UNAPPROVED" | "MATCHED" | undefined,
    page: number,
    pageSize: number,
  ): { total: number; records: PurchaseRecord[] } {
    const wanted = status === "UNAPPROVED" ? "PENDING_REVIEW" : status === "MATCHED" ? "MATCHED" : undefined;
    const matched = [...this.invoices.values()]
      .filter((invoice) => invoice.purchaserTin === buyerTin && invoice.invoiceDate.slice(0, 7) === taxPeriod)
      .filter((invoice) => (wanted ? invoice.approvalStatus === wanted : true))
      .sort((left, right) => left.clearedAt.localeCompare(right.clearedAt) || left.recordId.localeCompare(right.recordId));
    const start = (page - 1) * pageSize;
    return {
      total: matched.length,
      records: matched.slice(start, start + pageSize).map((invoice) => ({
        ramis_record_id: invoice.recordId,
        supplier_tin: invoice.supplierTin,
        supplier_name: invoice.supplierName,
        supplier_invoice_serial: invoice.serialNumber,
        invoice_date: invoice.invoiceDate,
        supply_date: invoice.supplyDate,
        value_excluding_vat: fromCents(invoice.netCents),
        vat_amount: fromCents(invoice.vatCents),
        total_consideration: fromCents(invoice.totalCents),
        submission_timestamp: invoice.clearedAt,
        approval_status: invoice.approvalStatus,
      })),
    };
  }

  approve(buyerTin: string, taxPeriod: string, recordIds: string[]): ApprovalResult {
    const seen = new Set<string>();
    const failures: { record_id: string; message: string }[] = [];
    let approved = 0;

    for (const recordId of recordIds) {
      if (seen.has(recordId)) {
        failures.push({ record_id: recordId, message: "Record id is repeated in this batch" });
        continue;
      }
      seen.add(recordId);
      const invoice = this.records.get(recordId);
      if (!invoice || invoice.purchaserTin !== buyerTin) {
        failures.push({ record_id: recordId, message: "Record was not found for this purchaser" });
        continue;
      }
      if (invoice.invoiceDate.slice(0, 7) !== taxPeriod) {
        failures.push({ record_id: recordId, message: `Record is outside tax period ${taxPeriod}` });
        continue;
      }
      invoice.approvalStatus = "MATCHED";
      approved += 1;
    }

    const failed = failures.length;
    const stamp = timestamp().slice(0, 7).replace("-", "");
    const result: ApprovalResult = {
      status: failed === 0 ? "SUCCESS" : approved > 0 ? "PARTIAL" : "FAILED",
      records_approved: approved,
      records_failed: failed,
      status_updated_to: "Matched",
      approval_batch_reference: `BAT-${stamp}-${this.nextBatch++}`,
    };
    if (failures.length > 0) result.failures = failures;
    return result;
  }

  hasInvoice(serialNumber: string): boolean {
    return this.invoices.has(serialNumber);
  }

  hasAdjustment(serialNumber: string): boolean {
    return this.adjustments.has(serialNumber);
  }

  private takeReplay<T extends ClearanceResponse | AdjustmentResponse>(
    bucket: string,
    tin: string,
    key: string,
    hash: string,
  ): T | undefined {
    const prior = this.idempotency.get(`${bucket}:${tin}:${key}`);
    if (!prior) return undefined;
    if (prior.hash !== hash) {
      throw new RamisError(
        409,
        Code.IMMUTABLE,
        "X-Idempotency-Key is already bound to a different submission",
        "X-Idempotency-Key",
      );
    }
    return prior.response as T;
  }

  private remember(
    bucket: string,
    tin: string,
    key: string,
    hash: string,
    response: ClearanceResponse | AdjustmentResponse,
  ): void {
    this.idempotency.set(`${bucket}:${tin}:${key}`, { hash, response });
  }
}

export function immutableInvoice(serialNumber: string): string {
  return `Invoice '${serialNumber}' has already been cleared. RAMIS records are immutable and cannot be modified. Issue a Schedule 04 Tax Credit/Debit Note instead.`;
}

function clearanceToken(prefix: string, clearedAt: string): string {
  const day = clearedAt.slice(0, 10).replaceAll("-", "");
  return `${prefix}-${day}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

function timestamp(date = new Date()): string {
  return date.toISOString();
}
