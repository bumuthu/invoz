import { createHash } from "node:crypto";
import { isTin, type InvoiceClass } from "@invoz/common";
import { prisma, type Prisma } from "@invoz/database";
import {
  idempotencyKey,
  payloadHash,
  RamisRejection,
  statutoryVatRate,
  submitAdjustment,
  type RamisAdjustment,
} from "@invoz/common/ramis";
import { alertRamisClearedCommitFailed } from "./alert";
import { adjustmentFields, requireColumn } from "./columns";
import { parseCsv } from "./csv";
import { RetryLater, isTransient, isUniqueConflict, messageOf } from "./failure";

type Entity = { id: number; organization_id: number; name: string; tin: string };

export type MappedAdjustment = {
  erpReference: string;
  adjustmentType: "credit_note" | "debit_note";
  adjustmentDate: string;
  originalReference: string;
  originalInvoiceDate: string;
  reason: string;
  buyerTin: string;
  buyerName: string;
  netAmount: string;
  vatRate: string;
  vatAmount: string;
  totalAmount: string;
};

export function adjustmentsFromCsv(csv: string, mapping: Record<string, string>): MappedAdjustment[] {
  const rows = parseCsv(csv);
  const header = rows[0];
  if (!header) throw new Error("invoice file has no header");
  const index = new Map<string, number>();
  for (const field of adjustmentFields) index.set(field, requireColumn(header, mapping, field));
  const notes: MappedAdjustment[] = [];
  for (const row of rows.slice(1)) {
    if (row.every((value) => value.trim() === "")) continue;
    const read = (field: (typeof adjustmentFields)[number]) => (row[index.get(field) ?? -1] ?? "").trim();
    const netAmount = money(read("adjustment_values.adjusted_value_excluding_vat"), "Adjusted value");
    const vatAmount = money(read("adjustment_values.adjusted_vat_amount"), "Adjusted VAT");
    const totalAmount = money(read("adjustment_values.adjusted_total_consideration"), "Adjusted total");
    const cents = (value: string) => Math.round(Number(value) * 100);
    if (cents(netAmount) + cents(vatAmount) !== cents(totalAmount)) {
      throw new Error("Adjusted value plus VAT must equal the adjusted total");
    }
    const buyerTin = read("purchaser.tin");
    if (!isTin(buyerTin)) throw new Error("buyer TIN must be 9 digits");
    notes.push({
      erpReference: required(read("header.adjustment_serial_number"), "Adjustment number"),
      adjustmentType: adjustmentType(read("header.adjustment_type")),
      adjustmentDate: date(read("header.adjustment_date"), "Adjustment date"),
      originalReference: required(read("header.original_invoice_serial_number"), "Original invoice"),
      originalInvoiceDate: date(read("header.original_invoice_date"), "Original invoice date"),
      reason: required(read("header.adjustment_reason"), "Adjustment reason"),
      buyerTin,
      buyerName: required(read("purchaser.name"), "Buyer name"),
      netAmount,
      vatRate: rate(read("adjustment_values.vat_rate")),
      vatAmount,
      totalAmount,
    });
  }
  if (notes.length === 0) throw new Error("invoice file has no invoices");
  return notes;
}

export async function submitMappedAdjustment(
  entity: Entity,
  objectKey: string,
  branchId: number | undefined,
  note: MappedAdjustment,
): Promise<"cleared" | "rejected"> {
  if (!branchId) throw new Error("invoice file is not in a branch folder");
  const branch = await prisma.branch.findFirst({
    where: { id: BigInt(branchId), legal_entity_id: BigInt(entity.id) },
    select: { id: true, name: true },
  });
  if (!branch) throw new Error(`branch ${branchId} is not in this legal entity`);
  const original = await prisma.outboundInvoice.findFirst({
    where: {
      legal_entity_id: BigInt(entity.id),
      OR: [{ serial_number: note.originalReference }, { erp_reference: note.originalReference }],
    },
    select: {
      id: true,
      serial_number: true,
      ramis_status: true,
      invoice_type: true,
      invoice_date: true,
      customer_tin: true,
      customer_name: true,
    },
  });
  if (!original || original.ramis_status !== "cleared" || !original.serial_number) {
    if (original?.ramis_status === "rejected") {
      throw new Error(`original invoice ${note.originalReference} was rejected`);
    }
    throw new RetryLater(`original invoice ${note.originalReference} is not cleared`);
  }
  const originalDate = original.invoice_date.toISOString().slice(0, 10);
  if (note.originalInvoiceDate !== originalDate) {
    throw new Error("original invoice date does not match the cleared invoice");
  }
  if (note.buyerTin !== original.customer_tin) {
    throw new Error("purchaser.tin does not match the original invoice");
  }
  const originalSerial = original.serial_number;
  if (!originalSerial) throw new RetryLater(`original invoice ${note.originalReference} is not cleared`);
  const expectedRate = statutoryVatRate(original.invoice_type as InvoiceClass);
  if (Number(note.vatRate) !== expectedRate) {
    throw new Error("adjustment VAT rate does not match the original invoice");
  }

  let clearance: { token: string; clearedAt: string; hash: string } | undefined;
  let serialNumber = "";
  try {
    const prepared = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`select set_config('statement_timeout', '55s', true)`;
        await tx.$executeRaw`select set_config('idle_in_transaction_session_timeout', '55s', true)`;
        const locked = await tx.$queryRaw<{ id: bigint; serial_number: string | null; ramis_status: string }[]>`
          select id, serial_number, ramis_status
          from outbound_adjustments
          where legal_entity_id = ${BigInt(entity.id)} and erp_reference = ${note.erpReference}
          for update
        `;
        const existing = locked[0];
        if (existing?.ramis_status === "cleared" || existing?.ramis_status === "rejected") {
          return { outcome: existing.ramis_status === "cleared" ? "cleared" : "rejected" } as const;
        }
        serialNumber = existing?.serial_number ?? (await nextSerial(tx, branch.id, note.adjustmentDate));
        const payload = adjustmentPayload(entity, branch.name, originalSerial, originalDate, note, serialNumber);
        const hash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
        const adjustmentId = existing
          ? existing.id
          : await insertQueued(tx, entity, branch.id, original.id, originalSerial, note, serialNumber, hash);
        return { outcome: "submit" as const, adjustmentId, payload, serialNumber };
      },
      { timeout: 55_000, maxWait: 10_000 },
    );
    if (prepared.outcome !== "submit") return prepared.outcome;
    serialNumber = prepared.serialNumber;
    clearance = await submitAdjustment(prepared.payload, idempotencyKey(objectKey, note.erpReference));
    await prisma.outboundAdjustment.update({
      where: { id: prepared.adjustmentId },
      data: {
        ramis_status: "cleared",
        ramis_clearance_token: clearance.token,
        ramis_payload_hash: clearance.hash,
        cleared_at: new Date(clearance.clearedAt),
        error_message: null,
      },
    });
    return "cleared";
  } catch (error) {
    if (clearance) {
      alertRamisClearedCommitFailed({
        organizationId: entity.organization_id,
        legalEntityId: entity.id,
        branchId: Number(branch.id),
        erpReference: note.erpReference,
        serialNumber,
        clearanceToken: clearance.token,
        clearedAt: clearance.clearedAt,
        error,
      });
      throw error;
    }
    if (error instanceof RetryLater || isTransient(error)) throw error;
    await saveAdjustmentRejection(entity, branch.id, original.id, originalSerial, note, messageOf(error), serialNumber);
    return "rejected";
  }
}

function adjustmentPayload(
  entity: Entity,
  place: string,
  originalSerial: string,
  originalDate: string,
  note: MappedAdjustment,
  serialNumber: string,
): RamisAdjustment {
  return {
    header: {
      adjustment_serial_number: serialNumber,
      adjustment_type: note.adjustmentType === "credit_note" ? "TAX_CREDIT_NOTE" : "TAX_DEBIT_NOTE",
      adjustment_date: note.adjustmentDate,
      original_invoice_serial_number: originalSerial,
      original_invoice_date: originalDate,
      adjustment_reason: note.reason,
    },
    supplier: { tin: entity.tin, name: entity.name, address: place },
    purchaser: { tin: note.buyerTin, name: note.buyerName, address: note.buyerName },
    adjustment_values: {
      adjusted_value_excluding_vat: Number(note.netAmount),
      vat_rate: Number(note.vatRate),
      adjusted_vat_amount: Number(note.vatAmount),
      adjusted_total_consideration: Number(note.totalAmount),
    },
  };
}

async function insertQueued(
  tx: Prisma.TransactionClient,
  entity: Entity,
  branchId: bigint,
  originalInvoiceId: bigint,
  originalSerial: string,
  note: MappedAdjustment,
  serialNumber: string,
  hash: string,
): Promise<bigint> {
  const created = await tx.outboundAdjustment.create({
    data: {
      organization_id: BigInt(entity.organization_id),
      legal_entity_id: BigInt(entity.id),
      branch_id: branchId,
      serial_number: serialNumber,
      adjustment_type: note.adjustmentType,
      erp_reference: note.erpReference,
      original_invoice_id: originalInvoiceId,
      original_serial_number: originalSerial,
      original_invoice_date: new Date(note.originalInvoiceDate),
      reason: note.reason,
      customer_tin: note.buyerTin,
      customer_name: note.buyerName,
      adjustment_date: new Date(note.adjustmentDate),
      adjusted_amount_exclusive_vat: note.netAmount,
      adjusted_vat_amount: note.vatAmount,
      adjusted_total_amount: note.totalAmount,
      ramis_status: "queued",
      ramis_payload_hash: hash,
    },
    select: { id: true },
  });
  return created.id;
}

async function saveAdjustmentRejection(
  entity: Entity,
  branchId: bigint,
  originalInvoiceId: bigint,
  originalSerial: string,
  note: MappedAdjustment,
  message: string,
  serialNumber: string,
): Promise<void> {
  const legalEntityId = BigInt(entity.id);
  const existing = await prisma.outboundAdjustment.findFirst({
    where: { legal_entity_id: legalEntityId, erp_reference: note.erpReference },
    select: { id: true, ramis_status: true, serial_number: true },
  });
  if (existing?.ramis_status === "cleared") return;
  if (existing) {
    await prisma.outboundAdjustment.update({
      where: { id: existing.id },
      data: { ramis_status: "rejected", error_message: message },
    });
    return;
  }
  const serial = serialNumber || (await nextSerial(prisma, branchId, note.adjustmentDate));
  const hash = payloadHash(`reject\n${entity.id}\n${note.erpReference}`);
  try {
    await prisma.outboundAdjustment.create({
      data: {
        organization_id: BigInt(entity.organization_id),
        legal_entity_id: legalEntityId,
        branch_id: branchId,
        serial_number: serial,
        adjustment_type: note.adjustmentType,
        erp_reference: note.erpReference,
        original_invoice_id: originalInvoiceId,
        original_serial_number: originalSerial,
        original_invoice_date: new Date(note.originalInvoiceDate),
        reason: note.reason,
        customer_tin: note.buyerTin,
        customer_name: note.buyerName,
        adjustment_date: new Date(note.adjustmentDate),
        adjusted_amount_exclusive_vat: note.netAmount,
        adjusted_vat_amount: note.vatAmount,
        adjusted_total_amount: note.totalAmount,
        ramis_status: "rejected",
        ramis_payload_hash: hash,
        error_message: message,
      },
    });
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;
    await prisma.outboundAdjustment.updateMany({
      where: { legal_entity_id: legalEntityId, erp_reference: note.erpReference, ramis_status: { not: "cleared" } },
      data: { ramis_status: "rejected", error_message: message },
    });
  }
}

async function nextSerial(tx: Prisma.TransactionClient | typeof prisma, branchId: bigint, invoiceDate: string): Promise<string> {
  const result = await tx.$queryRaw<{ serial: string }[]>`
    select next_gazette_serial(${branchId}::bigint, ${invoiceDate}::date) as serial
  `;
  const serial = result[0]?.serial;
  if (!serial) throw new Error("next serial was not returned");
  return serial;
}

function adjustmentType(value: string): "credit_note" | "debit_note" {
  const raw = value.trim().toUpperCase();
  if (raw === "TAX_CREDIT_NOTE" || raw === "CREDIT_NOTE") return "credit_note";
  if (raw === "TAX_DEBIT_NOTE" || raw === "DEBIT_NOTE") return "debit_note";
  throw new Error("adjustment type must be TAX_CREDIT_NOTE or TAX_DEBIT_NOTE");
}

function required(value: string, field: string): string {
  if (!value) throw new Error(`${field} is required`);
  return value;
}

function date(value: string, field: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${field} must be YYYY-MM-DD`);
  return value;
}

function money(value: string, field: string): string {
  if (!/^\d+(\.\d+)?$/.test(value)) throw new Error(`${field} must be numeric`);
  return Number(value).toFixed(2);
}

function rate(value: string): string {
  if (!/^\d+(\.\d+)?$/.test(value)) throw new Error("VAT rate must be numeric");
  return String(Number(value));
}
