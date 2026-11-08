import { headers } from "next/headers";
import { isBranchCode, isTin, portalRoles, type PortalRole } from "@invoz/common";
import { prisma } from "@invoz/database";
import { enqueueResubmit } from "@/lib/queue";
import { permissions, resolveAccess } from "@/lib/access";
import { canPollErp, isErpCode } from "@/lib/erps";
import { hostnameFrom, isLocalHost, organizationOrigin } from "@/lib/host";
import { supabase } from "@/lib/supabase";

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

export type InviteResult =
  | { ok: true; message: string; inviteUrl?: string }
  | { ok: false; error: string };

const inviteRoles = portalRoles.filter((role) => role !== "owner");

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
  return { ok: true, message: `Approved ${rows.length} purchase${rows.length === 1 ? "" : "s"}.` };
}

export async function requestSftp(organizationId: string, erpCode: string): Promise<ActionResult> {
  if (!isErpCode(erpCode)) return { ok: false, error: "That ERP is not supported." };
  const { access, error } = await authorize(organizationId);
  if (!access) return { ok: false, error };
  if (!permissions(access.role).canMap) {
    return { ok: false, error: "Your role cannot change an integration." };
  }

  const organization = BigInt(organizationId);
  const existing = await prisma.erpConnection.findFirst({
    where: { organization_id: organization, ingestion_mode: "sftp" },
    select: { id: true },
  });
  if (existing) return { ok: false, error: "This organization already has an SFTP integration." };

  try {
    await prisma.$transaction(async (tx) => {
      const connection = await tx.erpConnection.create({
        data: {
          organization_id: organization,
          legal_entity_id: null,
          erp_code: erpCode,
          ingestion_mode: "sftp",
          status: "offline",
        },
      });
      await tx.erpChangeRequest.create({
        data: {
          erp_connection_id: connection.id,
          organization_id: organization,
          user_id: access.userId,
          action: "enable",
        },
      });
      await tx.auditLog.create({
        data: {
          organization_id: organization,
          event: "erp.change_requested",
          detail: { action: "enable", ingestionMode: "sftp", erp: erpCode },
        },
      });
    });
  } catch (caught) {
    if (isUniqueViolation(caught)) {
      return { ok: false, error: "This organization already has an SFTP integration." };
    }
    throw caught;
  }
  return { ok: true, message: "SFTP request sent. It stays offline until it is approved." };
}

export async function requestPoll(input: {
  organizationId: string;
  erpCode: string;
  label: string;
  endpointUrl: string;
  apiKey: string;
  lastInvoiceId: string | null;
  connectionId: string | null;
}): Promise<ActionResult> {
  if (!canPollErp(input.erpCode)) return { ok: false, error: "Polling is available for SAP and IFS." };
  const label = input.label.trim();
  if (!label || label.length > 80) return { ok: false, error: "Enter a name for this API configuration." };
  const endpoint = endpointUrl(input.endpointUrl);
  if (!endpoint) return { ok: false, error: "Enter the billing document API." };
  const apiKey = input.apiKey.trim();
  if (!apiKey || apiKey.length > 500) return { ok: false, error: "Enter the API key." };
  const lastInvoiceId = optionalInvoiceId(input.lastInvoiceId);
  if (lastInvoiceId === "invalid") return { ok: false, error: "Enter the last billing document to skip." };
  const { access, error } = await authorize(input.organizationId);
  if (!access) return { ok: false, error };
  if (!permissions(access.role).canMap) {
    return { ok: false, error: "Your role cannot change an integration." };
  }

  const organization = BigInt(input.organizationId);
  if (input.connectionId === null) {
    const existing = await prisma.erpConnection.findFirst({
      where: { organization_id: organization, erp_code: input.erpCode, ingestion_mode: "poll" },
      select: { id: true },
    });
    if (existing) return { ok: false, error: "This ERP already has a polling request." };
  }

  const details = {
    legal_entity_id: null,
    label,
    endpoint_url: endpoint,
    api_username: null,
    api_secret: apiKey,
    last_invoice_id: lastInvoiceId,
  };
  if (input.connectionId !== null) {
    if (!/^\d+$/.test(input.connectionId)) return { ok: false, error: "Integration not found." };
    const connection = await prisma.erpConnection.findFirst({
      where: {
        id: BigInt(input.connectionId),
        organization_id: organization,
        erp_code: input.erpCode,
        ingestion_mode: "poll",
      },
    });
    if (!connection) return { ok: false, error: "Integration not found." };
    if (connection.status === "live") return { ok: false, error: "This integration is already live." };
    const pending = await prisma.erpChangeRequest.findFirst({
      where: { erp_connection_id: connection.id, status: "pending" },
      select: { id: true },
    });
    if (pending) return { ok: false, error: "A request is already waiting for this integration." };
    await prisma.$transaction([
      prisma.erpConnection.update({ where: { id: connection.id }, data: details }),
      prisma.erpChangeRequest.create({
        data: {
          erp_connection_id: connection.id,
          organization_id: organization,
          user_id: access.userId,
          action: "enable",
        },
      }),
      prisma.auditLog.create({
        data: {
          organization_id: organization,
          event: "erp.change_requested",
          detail: { action: "enable", ingestionMode: "poll", erp: input.erpCode, label },
        },
      }),
    ]);
    return { ok: true, message: "Polling request sent. It stays offline until it is approved." };
  }

  await prisma.$transaction(async (tx) => {
    const connection = await tx.erpConnection.create({
      data: {
        organization_id: organization,
        erp_code: input.erpCode,
        ingestion_mode: "poll",
        status: "offline",
        ...details,
      },
    });
    await tx.erpChangeRequest.create({
      data: {
        erp_connection_id: connection.id,
        organization_id: organization,
        user_id: access.userId,
        action: "enable",
      },
    });
    await tx.auditLog.create({
      data: {
        organization_id: organization,
        event: "erp.change_requested",
        detail: { action: "enable", ingestionMode: "poll", erp: input.erpCode, label },
      },
    });
  });
  return { ok: true, message: "Polling request sent. It stays offline until it is approved." };
}

export async function requestErpChange(
  organizationId: string,
  connectionId: string,
  action: "enable" | "disable",
): Promise<ActionResult> {
  if (!/^\d+$/.test(connectionId)) return { ok: false, error: "Integration not found." };
  const { access, error } = await authorize(organizationId);
  if (!access) return { ok: false, error };
  if (!permissions(access.role).canMap) {
    return { ok: false, error: "Your role cannot change an integration." };
  }

  const connection = await prisma.erpConnection.findFirst({
    where: { id: BigInt(connectionId), organization_id: BigInt(organizationId) },
  });
  if (!connection) return { ok: false, error: "Integration not found." };
  if (action === "enable" && connection.status === "live") {
    return { ok: false, error: "This integration is already live." };
  }
  if (action === "disable" && connection.status === "offline") {
    return { ok: false, error: "This integration is already offline." };
  }
  const pending = await prisma.erpChangeRequest.findFirst({
    where: { erp_connection_id: connection.id, status: "pending" },
    select: { id: true },
  });
  if (pending) return { ok: false, error: "A request is already waiting for this integration." };

  await prisma.$transaction([
    prisma.erpChangeRequest.create({
      data: {
        erp_connection_id: connection.id,
        organization_id: connection.organization_id,
        user_id: access.userId,
        action,
      },
    }),
    prisma.auditLog.create({
      data: {
        organization_id: connection.organization_id,
        legal_entity_id: connection.legal_entity_id,
        event: "erp.change_requested",
        detail: { action, ingestionMode: connection.ingestion_mode, erp: connection.erp_code },
      },
    }),
  ]);
  return {
    ok: true,
    message: action === "enable" ? "Enable request sent." : "Disable request sent.",
  };
}

export async function setRamisEnabled(
  organizationId: string,
  legalEntityId: string,
  enabled: boolean,
): Promise<ActionResult> {
  if (!/^\d+$/.test(legalEntityId)) return { ok: false, error: "Legal entity not found." };
  const { access, error } = await authorize(organizationId);
  if (!access) return { ok: false, error };
  if (!permissions(access.role).canMap) {
    return { ok: false, error: "Your role cannot change a RAMIS connection." };
  }
  const organization = BigInt(organizationId);
  const entity = await prisma.legalEntity.findFirst({
    where: { id: BigInt(legalEntityId), organization_id: organization },
    select: { id: true },
  });
  if (!entity) return { ok: false, error: "Legal entity not found." };
  await prisma.$transaction([
    prisma.legalEntity.update({ where: { id: entity.id }, data: { ramis_enabled: enabled } }),
    prisma.auditLog.create({
      data: {
        organization_id: organization,
        legal_entity_id: entity.id,
        event: enabled ? "ramis.enabled" : "ramis.disabled",
        detail: {},
      },
    }),
  ]);
  return { ok: true, message: enabled ? "Legal entity enabled for RAMIS." : "Legal entity disabled for RAMIS." };
}

export async function createLegalEntity(input: {
  organizationId: string;
  name: string;
  tin: string;
  vatNumber: string | null;
}): Promise<ActionResult> {
  const name = input.name.trim();
  if (!name || name.length > 120) return { ok: false, error: "Enter the legal entity name." };
  const tin = input.tin.trim();
  if (!isTin(tin)) return { ok: false, error: "TIN must be 9 digits." };
  const vatNumber = optionalVat(input.vatNumber);
  if (vatNumber === "invalid") return { ok: false, error: "VAT number is too long." };
  const { access, error } = await authorize(input.organizationId);
  if (!access) return { ok: false, error };
  if (!permissions(access.role).canMap) {
    return { ok: false, error: "Your role cannot change the organization." };
  }
  const organization = BigInt(input.organizationId);
  try {
    await prisma.$transaction(async (tx) => {
      const entity = await tx.legalEntity.create({
        data: {
          organization_id: organization,
          name,
          tin,
          vat_number: vatNumber,
          ramis_enabled: false,
        },
      });
      await tx.auditLog.create({
        data: {
          organization_id: organization,
          legal_entity_id: entity.id,
          event: "organization.entity_created",
          detail: { name, tin },
        },
      });
    });
  } catch (caught) {
    if (isUniqueViolation(caught)) return { ok: false, error: "That TIN is already used in this organization." };
    throw caught;
  }
  return { ok: true, message: "Legal entity added. It stays disabled for RAMIS until you enable it." };
}

export async function createBranch(input: {
  organizationId: string;
  legalEntityId: string;
  code: string;
  name: string;
}): Promise<ActionResult> {
  if (!/^\d+$/.test(input.legalEntityId)) return { ok: false, error: "Legal entity not found." };
  const code = input.code.trim().toUpperCase();
  if (!isBranchCode(code)) return { ok: false, error: "Branch code must be 1 to 15 letters or digits." };
  const name = input.name.trim();
  if (!name || name.length > 120) return { ok: false, error: "Enter the branch name." };
  const { access, error } = await authorize(input.organizationId);
  if (!access) return { ok: false, error };
  if (!permissions(access.role).canMap) {
    return { ok: false, error: "Your role cannot change the organization." };
  }
  const organization = BigInt(input.organizationId);
  const entity = await prisma.legalEntity.findFirst({
    where: { id: BigInt(input.legalEntityId), organization_id: organization },
    select: { id: true },
  });
  if (!entity) return { ok: false, error: "Legal entity not found." };
  try {
    await prisma.$transaction(async (tx) => {
      const branch = await tx.branch.create({
        data: { legal_entity_id: entity.id, code, name },
      });
      await tx.auditLog.create({
        data: {
          organization_id: organization,
          legal_entity_id: entity.id,
          event: "organization.branch_created",
          detail: { code, name, branchId: String(branch.id) },
        },
      });
    });
  } catch (caught) {
    if (isUniqueViolation(caught)) return { ok: false, error: "That branch code is already used on this legal entity." };
    throw caught;
  }
  return { ok: true, message: "Branch added." };
}

function optionalVat(value: string | null): string | null | "invalid" {
  if (value === null) return null;
  const vat = value.trim();
  if (!vat) return null;
  if (vat.length > 40) return "invalid";
  return vat;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

function optionalInvoiceId(value: string | null): string | null | "invalid" {
  if (value === null || value.trim() === "") return null;
  const invoiceId = value.trim();
  if (invoiceId.length > 40 || /[\s'"]/.test(invoiceId)) return "invalid";
  return invoiceId;
}

function endpointUrl(value: string): string | null {
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return trimmed;
  } catch {
    return null;
  }
}

export async function inviteMember(organizationId: string, emailInput: string, role: PortalRole): Promise<InviteResult> {
  const email = emailInput.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (!(inviteRoles as readonly string[]).includes(role)) {
    return { ok: false, error: "Choose a role other than owner." };
  }
  const { access, error } = await authorize(organizationId);
  if (!access) return { ok: false, error };
  if (!permissions(access.role).canInvite) {
    return { ok: false, error: "Your role cannot invite people." };
  }

  const organization = BigInt(organizationId);
  let userId = await authUserId(email);
  let inviteUrl: string | undefined;
  if (!userId) {
    const headerList = await headers();
    const hostHeader = headerList.get("host") ?? "";
    const hostname = hostnameFrom(headerList.get("x-portal-host") ?? hostHeader);
    const redirectTo = isLocalHost(hostname)
      ? `http://${hostHeader}/auth/login`
      : `${organizationOrigin(access.organization.slug, hostname)}/auth/login`;
    const invited = await supabase().auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        data: { name: email.split("@")[0] },
        redirectTo,
      },
    });
    if (invited.error || !invited.data.user) {
      const raced = await authUserId(email);
      if (!raced) {
        return { ok: false, error: invited.error?.message ?? "The invite could not be created." };
      }
      userId = raced;
    } else {
      userId = invited.data.user.id;
      inviteUrl = invited.data.properties.action_link;
    }
  }

  const membership = await prisma.membership.findUnique({
    where: { user_id_organization_id: { user_id: userId, organization_id: organization } },
  });
  if (membership) return { ok: false, error: "That person is already in this organization." };

  try {
    await prisma.membership.create({
      data: { user_id: userId, organization_id: organization, role },
    });
  } catch (caught) {
    if (isUnique(caught)) return { ok: false, error: "That person is already in this organization." };
    throw caught;
  }

  await prisma.auditLog.create({
    data: {
      organization_id: organization,
      event: "member.invited",
      detail: { email, role },
    },
  });
  return {
    ok: true,
    message: inviteUrl
      ? `Invite created for ${email}. Send them this link so they can set a password.`
      : `${email} can sign in and open this organization.`,
    inviteUrl,
  };
}

async function authUserId(email: string): Promise<string | undefined> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    select id from auth.users where lower(email) = ${email}
  `;
  return rows[0]?.id;
}

function isUnique(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002";
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
