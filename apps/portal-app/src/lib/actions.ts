"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@invoz/database";
import { enqueueResubmit } from "@/lib/queue";
import { permissions, resolveAccess } from "@/lib/access";
import { isErpCode } from "@/lib/erps";

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

const approvalLimit = 5000;

async function authorize(organizationId: string) {
  const access = await resolveAccess();
  const allowed = access.organizations.some((organization) => String(organization.id) === organizationId);
  if (!allowed || (access.hostPinned && String(access.organization.id) !== organizationId)) {
    return { access: null, error: "Organization not found." as const };
  }
  return { access, error: null };
}

export async function approveInbound(organizationId: string, ids: string[]): Promise<ActionResult> {
  if (ids.length === 0) return { ok: false, error: "Select at least one purchase." };
  if (ids.length > approvalLimit) {
    return { ok: false, error: "Approve at most 5,000 records at once." };
  }
  if (ids.some((id) => !/^\d+$/.test(id))) return { ok: false, error: "Purchase not found." };

  const { access, error } = await authorize(organizationId);
  if (!access) return { ok: false, error };
  if (!permissions(access.role).canApprove) {
    return { ok: false, error: "Your role cannot approve purchase records." };
  }

  const organization = BigInt(organizationId);
  const rows = await prisma.inboundInvoice.findMany({
    where: {
      id: { in: ids.map((id) => BigInt(id)) },
      organization_id: organization,
      is_approved_for_input_vat: false,
    },
    select: { id: true, legal_entity_id: true },
  });
  if (rows.length === 0) return { ok: false, error: "Those purchases are already approved." };

  await prisma.inboundInvoice.updateMany({
    where: { id: { in: rows.map((row) => row.id) }, organization_id: organization },
    data: {
      is_approved_for_input_vat: true,
      approved_at: new Date(),
      approved_by: access.userId,
    },
  });
  await prisma.auditLog.createMany({
    data: rows.map((row) => ({
      organization_id: organization,
      legal_entity_id: row.legal_entity_id,
      inbound_invoice_id: row.id,
      event: "schedule02.approved",
      detail: {},
    })),
  });
  revalidatePath("/", "layout");
  return { ok: true, message: `Approved ${rows.length} purchase${rows.length === 1 ? "" : "s"}.` };
}

export async function connectErp(organizationId: string, entityId: string, erpCode: string): Promise<ActionResult> {
  if (!/^\d+$/.test(entityId)) return { ok: false, error: "Legal entity not found." };
  if (!isErpCode(erpCode)) return { ok: false, error: "That ERP is not supported." };
  const { access, error } = await authorize(organizationId);
  if (!access) return { ok: false, error };
  if (!permissions(access.role).canMap) {
    return { ok: false, error: "Your role cannot connect an ERP." };
  }

  const entity = await prisma.legalEntity.findFirst({
    where: { id: BigInt(entityId), organization_id: BigInt(organizationId) },
  });
  if (!entity) return { ok: false, error: "Legal entity not found." };

  await prisma.erpConnection.upsert({
    where: { legal_entity_id: entity.id },
    create: { legal_entity_id: entity.id, erp_code: erpCode, status: "connected" },
    update: { erp_code: erpCode, status: "connected", connected_at: new Date() },
  });
  await prisma.auditLog.create({
    data: {
      organization_id: entity.organization_id,
      legal_entity_id: entity.id,
      event: "erp.connected",
      detail: { erp: erpCode },
    },
  });
  revalidatePath("/", "layout");
  return { ok: true, message: "ERP connected for this legal entity." };
}

export type DocumentCorrection = {
  buyerName: string;
  buyerTin: string;
  invoiceDate: string;
  supplyDate: string;
  net: string;
  vat: string;
  total: string;
  reason: string;
  originalSerial: string;
  originalDate: string;
};

export async function correctAndResubmit(
  organizationId: string,
  source: "invoice" | "adjustment",
  sourceId: string,
  correction: DocumentCorrection,
): Promise<ActionResult> {
  if (!/^\d+$/.test(sourceId)) return { ok: false, error: "Document not found." };
  const { access, error } = await authorize(organizationId);
  if (!access) return { ok: false, error };
  if (!permissions(access.role).canRequeue) {
    return { ok: false, error: "Your role cannot correct and resubmit documents." };
  }

  const buyerName = correction.buyerName.trim();
  const buyerTin = correction.buyerTin.trim();
  const net = money(correction.net, "Net");
  const vat = money(correction.vat, "VAT");
  const total = money(correction.total, "Total");
  if (!buyerName) return { ok: false, error: "Buyer name is required." };
  if (!/^\d{9}$/.test(buyerTin)) return { ok: false, error: "Buyer TIN must be 9 digits." };
  if ("error" in net) return { ok: false, error: net.error };
  if ("error" in vat) return { ok: false, error: vat.error };
  if ("error" in total) return { ok: false, error: total.error };
  if (Math.round((Number(net.value) + Number(vat.value)) * 100) !== Math.round(Number(total.value) * 100)) {
    return { ok: false, error: "Net plus VAT must equal the total." };
  }

  const organization = BigInt(organizationId);
  const id = BigInt(sourceId);
  const changed: Record<string, { from: string; to: string }> = {};
  const track = (field: string, from: string, to: string) => {
    if (from !== to) changed[field] = { from, to };
  };

  if (source === "invoice") {
    const invoiceDate = dateField(correction.invoiceDate, "Invoice date");
    const supplyDate = dateField(correction.supplyDate, "Supply date");
    if ("error" in invoiceDate) return { ok: false, error: invoiceDate.error };
    if ("error" in supplyDate) return { ok: false, error: supplyDate.error };
    const row = await prisma.outboundInvoice.findFirst({
      where: { id, organization_id: organization },
      include: { branch: { select: { code: true } } },
    });
    if (!row) return { ok: false, error: "Document not found." };
    if (row.ramis_status === "cleared") return { ok: false, error: "A cleared invoice cannot be changed." };
    if (row.ramis_status !== "rejected") return { ok: false, error: "Only a rejected document can be corrected." };
    track("buyerName", row.customer_name, buyerName);
    track("buyerTin", row.customer_tin, buyerTin);
    track("invoiceDate", row.invoice_date.toISOString().slice(0, 10), invoiceDate.value);
    track("supplyDate", row.supply_date.toISOString().slice(0, 10), supplyDate.value);
    track("net", row.amount_exclusive_vat.toFixed(2), net.value);
    track("vat", row.vat_amount.toFixed(2), vat.value);
    track("total", row.total_amount.toFixed(2), total.value);
    await prisma.outboundInvoice.update({
      where: { id },
      data: {
        customer_name: buyerName,
        customer_tin: buyerTin,
        invoice_date: new Date(invoiceDate.value),
        supply_date: new Date(supplyDate.value),
        amount_exclusive_vat: net.value,
        vat_amount: vat.value,
        total_amount: total.value,
        ramis_status: "queued",
        error_message: null,
      },
    });
    return queueDocument(organization, row.legal_entity_id, row.branch.code, "invoice", id, changed);
  } else {
    const noteDate = dateField(correction.invoiceDate, "Note date");
    const originalDate = dateField(correction.originalDate, "Original invoice date");
    const reason = correction.reason.trim();
    const originalSerial = correction.originalSerial.trim();
    if ("error" in noteDate) return { ok: false, error: noteDate.error };
    if ("error" in originalDate) return { ok: false, error: originalDate.error };
    if (!reason) return { ok: false, error: "Reason is required." };
    if (!originalSerial) return { ok: false, error: "Original serial is required." };
    const row = await prisma.outboundAdjustment.findFirst({
      where: { id, organization_id: organization },
      include: { branch: { select: { code: true } } },
    });
    if (!row) return { ok: false, error: "Document not found." };
    if (row.ramis_status === "cleared") return { ok: false, error: "A cleared note cannot be changed." };
    if (row.ramis_status !== "rejected") return { ok: false, error: "Only a rejected document can be corrected." };
    track("buyerName", row.customer_name ?? "", buyerName);
    track("buyerTin", row.customer_tin ?? "", buyerTin);
    track("noteDate", row.adjustment_date.toISOString().slice(0, 10), noteDate.value);
    track("reason", row.reason, reason);
    track("originalSerial", row.original_serial_number, originalSerial);
    track("originalDate", row.original_invoice_date.toISOString().slice(0, 10), originalDate.value);
    track("net", row.adjusted_amount_exclusive_vat.toFixed(2), net.value);
    track("vat", row.adjusted_vat_amount.toFixed(2), vat.value);
    track("total", row.adjusted_total_amount.toFixed(2), total.value);
    await prisma.outboundAdjustment.update({
      where: { id },
      data: {
        customer_name: buyerName,
        customer_tin: buyerTin,
        adjustment_date: new Date(noteDate.value),
        reason,
        original_serial_number: originalSerial,
        original_invoice_date: new Date(originalDate.value),
        adjusted_amount_exclusive_vat: net.value,
        adjusted_vat_amount: vat.value,
        adjusted_total_amount: total.value,
        ramis_status: "queued",
        error_message: null,
      },
    });
    return queueDocument(organization, row.legal_entity_id, row.branch.code, "adjustment", id, changed);
  }
}

async function queueDocument(
  organization: bigint,
  legalEntityId: bigint,
  branchCode: string,
  source: "invoice" | "adjustment",
  id: bigint,
  changed: Record<string, { from: string; to: string }>,
): Promise<ActionResult> {
  try {
    await enqueueResubmit({
      source: "resubmit",
      organizationId: Number(organization),
      legalEntityId: Number(legalEntityId),
      branchCode,
      document: source,
      documentId: Number(id),
    });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "The document could not be queued.";
    const data = { ramis_status: "rejected" as const, error_message: message };
    if (source === "invoice") await prisma.outboundInvoice.update({ where: { id }, data });
    else await prisma.outboundAdjustment.update({ where: { id }, data });
    revalidatePath("/", "layout");
    return { ok: false, error: message };
  }
  await prisma.auditLog.create({
    data: {
      organization_id: organization,
      legal_entity_id: legalEntityId,
      outbound_invoice_id: source === "invoice" ? id : null,
      outbound_adjustment_id: source === "adjustment" ? id : null,
      event: "document.resubmitted",
      detail: { changed },
    },
  });
  revalidatePath("/", "layout");
  return { ok: true, message: "Document queued for resubmission." };
}

function dateField(value: string, label: string): { value: string } | { error: string } {
  const date = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: `${label} must be YYYY-MM-DD.` };
  return { value: date };
}

function money(value: string, label: string): { value: string } | { error: string } {
  const amount = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(amount)) return { error: `${label} must be a number.` };
  return { value: Number(amount).toFixed(2) };
}
