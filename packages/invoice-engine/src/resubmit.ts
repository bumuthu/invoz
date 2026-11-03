import type { InvoiceClass, ResubmitJob } from "@invoz/common";
import { prisma } from "@invoz/database";
import {
  payloadHash,
  RamisRejection,
  resubmitIdempotencyKey,
  statutoryVatRate,
  submitAdjustment,
  submitInvoice,
  invoiceTypeCode,
  type RamisAdjustment,
  type RamisInvoice,
} from "@invoz/common/ramis";

export async function processResubmit(job: ResubmitJob): Promise<void> {
  if (job.document === "invoice") {
    await resubmitInvoice(job);
    return;
  }
  await resubmitAdjustment(job);
}

async function resubmitInvoice(job: ResubmitJob): Promise<void> {
  const row = await prisma.outboundInvoice.findFirst({
    where: { id: BigInt(job.documentId), organization_id: BigInt(job.organizationId) },
    include: { legalEntity: true, branch: true },
  });
  if (!row || !row.serial_number) throw new Error("Rejected invoice was not found.");
  if (Number(row.legal_entity_id) !== job.legalEntityId || row.branch.code !== job.branchCode) {
    throw new Error("invoice does not match this job");
  }
  if (row.ramis_status === "cleared") return;
  if (row.ramis_status !== "queued" && row.ramis_status !== "rejected") {
    throw new Error("invoice is not waiting for resubmit");
  }
  const place = row.place_of_supply || row.branch.name;
  const payload: RamisInvoice = {
    header: {
      serial_number: row.serial_number,
      erp_reference: row.erp_reference,
      invoice_date: row.invoice_date.toISOString().slice(0, 10),
      supply_date: row.supply_date.toISOString().slice(0, 10),
      invoice_type: invoiceTypeCode(row.invoice_type),
      place_of_supply: place,
    },
    supplier: { tin: row.legalEntity.tin, name: row.legalEntity.name, address: place },
    purchaser: {
      tin: row.customer_tin,
      name: row.customer_name,
      address: row.customer_address || row.customer_name,
    },
    currency_summary: summary(
      row.invoice_type,
      row.currency,
      row.exchange_rate.toString(),
      row.amount_exclusive_vat.toString(),
      row.vat_amount.toString(),
      row.total_amount.toString(),
    ),
    line_items: [
      line(
        row.erp_reference,
        row.invoice_type,
        row.amount_exclusive_vat.toString(),
        row.vat_amount.toString(),
        row.total_amount.toString(),
      ),
    ],
  };
  await finish("invoice", row.id, payload, () => submitInvoice(payload, resubmitIdempotencyKey(payload)));
}

async function resubmitAdjustment(job: ResubmitJob): Promise<void> {
  const row = await prisma.outboundAdjustment.findFirst({
    where: { id: BigInt(job.documentId), organization_id: BigInt(job.organizationId) },
    include: { legalEntity: true, branch: true, originalInvoice: true },
  });
  if (!row || !row.serial_number) throw new Error("Rejected note was not found.");
  if (Number(row.legal_entity_id) !== job.legalEntityId || row.branch.code !== job.branchCode) {
    throw new Error("note does not match this job");
  }
  if (row.ramis_status === "cleared") return;
  if (row.ramis_status !== "queued" && row.ramis_status !== "rejected") {
    throw new Error("note is not waiting for resubmit");
  }
  const net = Number(row.adjusted_amount_exclusive_vat);
  const vat = Number(row.adjusted_vat_amount);
  const rate = net === 0 || vat === 0 ? 0 : Math.round((vat / net) * 10000) / 100;
  const payload: RamisAdjustment = {
    header: {
      adjustment_serial_number: row.serial_number,
      adjustment_type: row.adjustment_type === "credit_note" ? "TAX_CREDIT_NOTE" : "TAX_DEBIT_NOTE",
      adjustment_date: row.adjustment_date.toISOString().slice(0, 10),
      original_invoice_serial_number: row.original_serial_number,
      original_invoice_date: row.original_invoice_date.toISOString().slice(0, 10),
      adjustment_reason: row.reason,
    },
    supplier: { tin: row.legalEntity.tin, name: row.legalEntity.name, address: row.branch.name },
    purchaser: {
      tin: row.customer_tin ?? row.originalInvoice.customer_tin,
      name: row.customer_name ?? row.originalInvoice.customer_name,
      address: row.customer_name ?? row.originalInvoice.customer_name,
    },
    adjustment_values: {
      adjusted_value_excluding_vat: net,
      vat_rate: rate,
      adjusted_vat_amount: vat,
      adjusted_total_consideration: Number(row.adjusted_total_amount),
    },
  };
  await finish("adjustment", row.id, payload, () => submitAdjustment(payload, resubmitIdempotencyKey(payload)));
}

function summary(
  invoiceType: InvoiceClass,
  currency: string,
  exchangeRate: string,
  net: string,
  vat: string,
  total: string,
): RamisInvoice["currency_summary"] {
  return {
    currency,
    exchange_rate: Number(exchangeRate),
    total_value_excluding_vat: Number(net),
    vat_rate: statutoryVatRate(invoiceType),
    total_vat_amount: Number(vat),
    total_consideration_including_vat: Number(total),
  };
}

function line(
  description: string,
  invoiceType: InvoiceClass,
  net: string,
  vat: string,
  total: string,
): RamisInvoice["line_items"][number] {
  return {
    item_sequence: 1,
    description,
    quantity: 1,
    unit_of_measure: "UNITS",
    unit_price: Number(net),
    line_amount_excluding_vat: Number(net),
    vat_rate: statutoryVatRate(invoiceType),
    vat_amount: Number(vat),
    line_total_including_vat: Number(total),
  };
}

async function finish(
  source: "invoice" | "adjustment",
  id: bigint,
  payload: unknown,
  submit: () => Promise<{ token: string; clearedAt: string; hash: string }>,
): Promise<void> {
  const hash = payloadHash(payload);
  try {
    const clearance = await submit();
    const data = {
      ramis_status: "cleared" as const,
      ramis_clearance_token: clearance.token,
      ramis_payload_hash: clearance.hash,
      cleared_at: new Date(clearance.clearedAt),
      error_message: null,
    };
    if (source === "invoice") await prisma.outboundInvoice.update({ where: { id }, data });
    else await prisma.outboundAdjustment.update({ where: { id }, data });
  } catch (error) {
    if (error instanceof RamisRejection) {
      const data = { ramis_status: "rejected" as const, error_message: error.message, ramis_payload_hash: hash };
      if (source === "invoice") await prisma.outboundInvoice.update({ where: { id }, data });
      else await prisma.outboundAdjustment.update({ where: { id }, data });
      return;
    }
    throw error;
  }
}
