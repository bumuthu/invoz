import { randomBytes } from "node:crypto";
import { Code, RamisError } from "./errors";
import { fromCents } from "./money";
import { MemoryStore, type InvoiceRecord, type Store, type StoreTx } from "./store";
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

export class Ledger {
  constructor(private readonly store: Store = new MemoryStore()) {}

  invoiceCount(): Promise<number> {
    return this.store.transaction((tx) => tx.invoiceCount());
  }

  adjustmentCount(): Promise<number> {
    return this.store.transaction((tx) => tx.adjustmentCount());
  }

  reset(): Promise<void> {
    return this.store.transaction((tx) => tx.reset());
  }

  clearInvoice(invoice: NormalizedInvoice, idempotencyKey: string): Promise<ClearanceResponse> {
    return this.store.transaction((tx) => this.clearInvoiceOn(tx, invoice, idempotencyKey));
  }

  clearAdjustment(adjustment: NormalizedAdjustment, idempotencyKey: string): Promise<AdjustmentResponse> {
    return this.store.transaction((tx) => this.clearAdjustmentOn(tx, adjustment, idempotencyKey));
  }

  hasInvoice(serialNumber: string): Promise<boolean> {
    return this.store.transaction((tx) => tx.hasInvoice(serialNumber));
  }

  hasAdjustment(serialNumber: string): Promise<boolean> {
    return this.store.transaction((tx) => tx.hasAdjustment(serialNumber));
  }

  private async clearInvoiceOn(
    tx: StoreTx,
    invoice: NormalizedInvoice,
    idempotencyKey: string,
  ): Promise<ClearanceResponse> {
    await tx.lock(`idempotency:invoice:${invoice.supplier.tin}:${idempotencyKey}`);
    await tx.lock(`serial:${invoice.serialNumber}`);

    const replay = await takeReplay<ClearanceResponse>(tx, "invoice", invoice.supplier.tin, idempotencyKey, invoice.hash);
    if (replay) return replay;

    const existing = await tx.invoice(invoice.serialNumber);
    if (existing) {
      if (existing.hash === invoice.hash) {
        await remember(tx, "invoice", invoice.supplier.tin, idempotencyKey, invoice.hash, existing.response);
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
      remainingVatCents: invoice.vatCents,
      clearedAt,
      response,
    };
    await tx.insertInvoice(record);
    await remember(tx, "invoice", invoice.supplier.tin, idempotencyKey, invoice.hash, response);
    return response;
  }

  private async clearAdjustmentOn(
    tx: StoreTx,
    adjustment: NormalizedAdjustment,
    idempotencyKey: string,
  ): Promise<AdjustmentResponse> {
    await tx.lock(`idempotency:adjustment:${adjustment.supplier.tin}:${idempotencyKey}`);
    await tx.lock(`serial:${adjustment.serialNumber}`);
    await tx.lock(`serial:${adjustment.originalSerialNumber}`);

    const replay = await takeReplay<AdjustmentResponse>(
      tx,
      "adjustment",
      adjustment.supplier.tin,
      idempotencyKey,
      adjustment.hash,
    );
    if (replay) return replay;

    const existing = await tx.adjustment(adjustment.serialNumber);
    if (existing) {
      if (existing.hash === adjustment.hash) {
        await remember(tx, "adjustment", adjustment.supplier.tin, idempotencyKey, adjustment.hash, existing.response);
        return existing.response;
      }
      throw new RamisError(
        409,
        Code.IMMUTABLE,
        `Adjustment '${adjustment.serialNumber}' has already been cleared. RAMIS records are immutable and cannot be modified.`,
        "header.adjustment_serial_number",
      );
    }

    const invoice = await tx.invoice(adjustment.originalSerialNumber);
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
    await tx.saveInvoice(invoice);

    const clearedAt = timestamp();
    const response: AdjustmentResponse = {
      status: "CLEARED",
      ramis_adjustment_token: clearanceToken("RAMIS-ADJ", clearedAt),
      adjustment_serial_number: adjustment.serialNumber,
      original_invoice_serial_number: adjustment.originalSerialNumber,
      cleared_timestamp: clearedAt,
    };
    await tx.insertAdjustment({ serialNumber: adjustment.serialNumber, hash: adjustment.hash, response });
    await remember(tx, "adjustment", adjustment.supplier.tin, idempotencyKey, adjustment.hash, response);
    return response;
  }
}

async function takeReplay<T extends ClearanceResponse | AdjustmentResponse>(
  tx: StoreTx,
  bucket: string,
  tin: string,
  key: string,
  hash: string,
): Promise<T | undefined> {
  const prior = await tx.idempotency(bucket, tin, key);
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

function remember(
  tx: StoreTx,
  bucket: string,
  tin: string,
  key: string,
  hash: string,
  response: ClearanceResponse | AdjustmentResponse,
): Promise<void> {
  return tx.remember(bucket, tin, key, hash, response);
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
