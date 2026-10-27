"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@invoz/database";
import { permissions, resolveAccess } from "@/lib/access";
import { isTargetField } from "@/lib/fields";

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
    return { ok: false, error: "Your role cannot approve Schedule 02 records." };
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

export async function requeueDocument(
  organizationId: string,
  source: "invoice" | "adjustment",
  sourceId: string,
): Promise<ActionResult> {
  if (!/^\d+$/.test(sourceId)) return { ok: false, error: "Document not found." };
  const { access, error } = await authorize(organizationId);
  if (!access) return { ok: false, error };
  if (!permissions(access.role).canRequeue) {
    return { ok: false, error: "Your role cannot re-queue documents." };
  }

  const organization = BigInt(organizationId);
  const id = BigInt(sourceId);
  if (source === "invoice") {
    const row = await prisma.outboundInvoice.findFirst({
      where: { id, organization_id: organization },
    });
    if (!row) return { ok: false, error: "Document not found." };
    if (row.ramis_status === "cleared") {
      return { ok: false, error: "A cleared invoice cannot be re-queued." };
    }
    if (row.ramis_status !== "rejected") {
      return { ok: false, error: "Only a rejected document can be re-queued." };
    }
    await prisma.outboundInvoice.update({
      where: { id },
      data: { ramis_status: "queued" },
    });
    await prisma.auditLog.create({
      data: {
        organization_id: organization,
        legal_entity_id: row.legal_entity_id,
        outbound_invoice_id: row.id,
        event: "document.requeued",
        detail: { serial: row.serial_number },
      },
    });
  } else {
    const row = await prisma.outboundAdjustment.findFirst({
      where: { id, organization_id: organization },
    });
    if (!row) return { ok: false, error: "Document not found." };
    if (row.ramis_status === "cleared") {
      return { ok: false, error: "A cleared invoice cannot be re-queued." };
    }
    if (row.ramis_status !== "rejected") {
      return { ok: false, error: "Only a rejected document can be re-queued." };
    }
    await prisma.outboundAdjustment.update({
      where: { id },
      data: { ramis_status: "queued" },
    });
    await prisma.auditLog.create({
      data: {
        organization_id: organization,
        legal_entity_id: row.legal_entity_id,
        outbound_adjustment_id: row.id,
        event: "document.requeued",
        detail: { serial: row.serial_number },
      },
    });
  }

  revalidatePath("/", "layout");
  return { ok: true, message: "Document queued again." };
}

export async function saveFieldMappings(
  organizationId: string,
  entityId: string,
  rows: { source: string; target: string }[],
): Promise<ActionResult> {
  if (!/^\d+$/.test(entityId)) return { ok: false, error: "Legal entity not found." };
  const { access, error } = await authorize(organizationId);
  if (!access) return { ok: false, error };
  if (!permissions(access.role).canMap) {
    return { ok: false, error: "Your role cannot change field mapping." };
  }

  const entity = await prisma.legalEntity.findFirst({
    where: { id: BigInt(entityId), organization_id: BigInt(organizationId) },
  });
  if (!entity) return { ok: false, error: "Legal entity not found." };

  const mappings = rows.map((row) => ({
    source: row.source.trim(),
    target: row.target.trim(),
  }));
  if (mappings.some((row) => !row.source || !isTargetField(row.target))) {
    return { ok: false, error: "Each column needs a source name and a portal field." };
  }
  const sources = new Set(mappings.map((row) => row.source));
  if (sources.size !== mappings.length) {
    return { ok: false, error: "Source columns must be unique." };
  }

  const legalEntityId = entity.id;
  await prisma.$transaction(async (tx) => {
    await tx.fieldMapping.deleteMany({ where: { legal_entity_id: legalEntityId } });
    if (mappings.length > 0) {
      await tx.fieldMapping.createMany({
        data: mappings.map((row) => ({
          legal_entity_id: legalEntityId,
          source_column: row.source,
          target_field: row.target,
        })),
      });
    }
    await tx.auditLog.create({
      data: {
        organization_id: entity.organization_id,
        legal_entity_id: legalEntityId,
        event: "mapping.saved",
        detail: { columns: mappings.length },
      },
    });
  });
  revalidatePath("/", "layout");
  return { ok: true, message: "Field mapping saved." };
}
