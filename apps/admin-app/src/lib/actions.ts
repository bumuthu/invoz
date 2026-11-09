import "server-only";
import {
  assertBranchCode,
  assertOrganizationSlug,
  assertPositiveInt,
  assertTin,
  isBranchCode,
  isOrganizationSlug,
  isTin,
} from "@invoz/common";
import { hashSecret } from "@invoz/common/secret";
import { prisma } from "@invoz/database";
import { requireAdmin, type Admin } from "@/lib/access";
import { AdminError } from "@/lib/errors";
import { ensureUploadPrefix, newPassword, transferHost } from "@/lib/sftp";
import { supabase } from "@/lib/supabase";
import type { ActionResult, IssuedPassword, OnboardInput } from "@/lib/types";

export async function onboardOrganization(input: OnboardInput): Promise<ActionResult> {
  const admin = await requireAdmin();
  const name = requiredText(input.name, "Enter the organization name.", 160);
  const slug = input.slug.trim().toLowerCase();
  if (!isOrganizationSlug(slug)) {
    return { ok: false, error: "The slug must be a hostname label, and not www, admin, app, or api." };
  }
  assertOrganizationSlug(slug);
  let allowance = Number(input.allowance);
  if (!Number.isInteger(allowance)) return { ok: false, error: "Allowance must be a positive integer." };
  try {
    assertPositiveInt(allowance, "allowance");
  } catch {
    return { ok: false, error: "Allowance must be a positive integer." };
  }
  const ownerName = requiredText(input.ownerName, "Enter the owner name.", 120);
  const ownerEmail = input.ownerEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) return { ok: false, error: "Enter the owner email." };
  const entities = normalizeEntities(input.entities);
  const normalized = entities.entities;
  if (!entities.ok || !normalized) return { ok: false, error: entities.error ?? "Add at least one legal entity." };

  const taken = await prisma.organization.findUnique({ where: { slug }, select: { id: true } });
  if (taken) return { ok: false, error: "That slug is already in use." };

  const existing = await prisma.$queryRaw<{ id: string }[]>`
    select id from auth.users where lower(email) = ${ownerEmail}
  `;
  let userId = existing[0]?.id;
  if (userId) {
    const membership = await prisma.membership.findFirst({ where: { user_id: userId }, select: { id: true } });
    if (membership) return { ok: false, error: "That email already belongs to an organization." };
  } else {
    if (input.ownerPassword.length < 8) return { ok: false, error: "The owner password must be at least 8 characters." };
    const created = await supabase().auth.admin.createUser({
      email: ownerEmail,
      password: input.ownerPassword,
      email_confirm: true,
      user_metadata: { name: ownerName },
    });
    if (created.error || !created.data.user) {
      return { ok: false, error: created.error?.message ?? "The owner account was not created." };
    }
    userId = created.data.user.id;
  }

  const organization = await prisma.$transaction(async (tx) => {
    const created = await tx.organization.create({
      data: {
        name,
        slug,
        monthly_allowance: allowance,
        legalEntities: {
          create: normalized.map((entity) => ({
            name: entity.name,
            tin: entity.tin,
            vat_number: entity.vatNumber,
            branches: { create: entity.branches },
          })),
        },
        memberships: { create: { user_id: userId, role: "owner" } },
      },
    });
    await tx.auditLog.create({
      data: {
        organization_id: created.id,
        event: "organization.onboarded",
        detail: { slug, owner_email: ownerEmail, admin_user_id: admin.userId },
      },
    });
    return created;
  });
  return { ok: true, id: String(organization.id) };
}

export async function updateOrganizationName(id: string, nameInput: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const organizationId = organizationKey(id);
  if (!organizationId) return { ok: false, error: "Organization not found." };
  const name = requiredText(nameInput, "Enter the organization name.", 160);
  const organization = await prisma.organization.update({
    where: { id: organizationId },
    data: { name },
  }).catch(() => null);
  if (!organization) return { ok: false, error: "Organization not found." };
  await prisma.auditLog.create({
    data: {
      organization_id: organization.id,
      event: "organization.updated",
      detail: { name, admin_user_id: admin.userId },
    },
  });
  return { ok: true };
}

export async function updateAllowance(id: string, allowanceInput: number): Promise<ActionResult> {
  const admin = await requireAdmin();
  const organizationId = organizationKey(id);
  if (!organizationId) return { ok: false, error: "Organization not found." };
  const allowance = Number(allowanceInput);
  try {
    assertPositiveInt(allowance, "allowance");
  } catch {
    return { ok: false, error: "Allowance must be a positive integer." };
  }
  const organization = await prisma.organization.update({
    where: { id: organizationId },
    data: { monthly_allowance: allowance },
  }).catch(() => null);
  if (!organization) return { ok: false, error: "Organization not found." };
  await prisma.auditLog.create({
    data: {
      organization_id: organization.id,
      event: "subscription.updated",
      detail: { monthly_allowance: allowance, admin_user_id: admin.userId },
    },
  });
  return { ok: true };
}

export async function addLegalEntity(input: {
  organizationId: string;
  name: string;
  tin: string;
  vatNumber: string;
}): Promise<ActionResult> {
  const admin = await requireAdmin();
  const organizationId = organizationKey(input.organizationId);
  if (!organizationId) return { ok: false, error: "Organization not found." };
  const name = requiredText(input.name, "Enter the legal entity name.", 160);
  const tin = input.tin.trim();
  if (!isTin(tin)) return { ok: false, error: "TIN must be 9 digits." };
  assertTin(tin);
  const vatNumber = optionalText(input.vatNumber, 40);
  const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } });
  if (!organization) return { ok: false, error: "Organization not found." };
  try {
    const entity = await prisma.$transaction(async (tx) => {
      const created = await tx.legalEntity.create({
        data: { organization_id: organizationId, name, tin, vat_number: vatNumber },
      });
      await tx.auditLog.create({
        data: {
          organization_id: organizationId,
          legal_entity_id: created.id,
          event: "legal_entity.created",
          detail: { name, tin, admin_user_id: admin.userId },
        },
      });
      return created;
    });
    return { ok: true, id: String(entity.id) };
  } catch {
    return { ok: false, error: "That TIN is already used in this organization." };
  }
}

export async function addBranch(input: { legalEntityId: string; code: string; name: string }): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!/^\d+$/.test(input.legalEntityId)) return { ok: false, error: "Legal entity not found." };
  const code = input.code.trim();
  const name = requiredText(input.name, "Enter the branch name.", 160);
  if (!isBranchCode(code)) return { ok: false, error: "Branch code must be 1 to 15 letters or digits." };
  assertBranchCode(code);
  const entity = await prisma.legalEntity.findUnique({
    where: { id: BigInt(input.legalEntityId) },
    select: { id: true, organization_id: true },
  });
  if (!entity) return { ok: false, error: "Legal entity not found." };
  try {
    const branch = await prisma.$transaction(async (tx) => {
      const created = await tx.branch.create({
        data: { legal_entity_id: entity.id, code, name },
      });
      await tx.auditLog.create({
        data: {
          organization_id: entity.organization_id,
          legal_entity_id: entity.id,
          event: "branch.created",
          detail: { code, name, admin_user_id: admin.userId },
        },
      });
      return created;
    });
    return { ok: true, id: String(branch.id) };
  } catch {
    return { ok: false, error: "That branch code is already used for this legal entity." };
  }
}

export async function setRamisEnabled(legalEntityId: string, enabled: boolean): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!/^\d+$/.test(legalEntityId) || typeof enabled !== "boolean") {
    return { ok: false, error: "Legal entity not found." };
  }
  const entity = await prisma.legalEntity.findUnique({
    where: { id: BigInt(legalEntityId) },
    select: { id: true, organization_id: true },
  });
  if (!entity) return { ok: false, error: "Legal entity not found." };
  await prisma.$transaction([
    prisma.legalEntity.update({ where: { id: entity.id }, data: { ramis_enabled: enabled } }),
    prisma.auditLog.create({
      data: {
        organization_id: entity.organization_id,
        legal_entity_id: entity.id,
        event: "ramis.updated",
        detail: { ramis_enabled: enabled, admin_user_id: admin.userId },
      },
    }),
  ]);
  return { ok: true };
}

export async function decideRequest(requestId: string, decision: "approve" | "reject"): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!/^\d+$/.test(requestId)) return { ok: false, error: "Request not found." };
  const request = await prisma.erpChangeRequest.findUnique({
    where: { id: BigInt(requestId) },
    include: { connection: true },
  });
  if (!request || request.status !== "pending") return { ok: false, error: "That request is no longer pending." };
  if (decision === "reject") {
    await prisma.$transaction([
      prisma.erpChangeRequest.update({
        where: { id: request.id },
        data: { status: "rejected", decided_at: new Date() },
      }),
      prisma.auditLog.create({
        data: {
          organization_id: request.organization_id,
          event: "erp.change_rejected",
          detail: detail(admin, request.connection.ingestion_mode, request),
        },
      }),
    ]);
    return { ok: true };
  }
  if (request.action !== "enable" && request.action !== "disable") {
    return { ok: false, error: "That request action is not supported." };
  }
  if (request.connection.ingestion_mode === "sftp") return approveSftp(admin, request);
  if (request.connection.ingestion_mode === "poll") return approvePoll(admin, request);
  return { ok: false, error: "That connection is not SFTP or polling." };
}

export async function rotateSftpPassword(organizationId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = organizationKey(organizationId);
  if (!id) return { ok: false, error: "Organization not found." };
  const credential = await prisma.sftpCredential.findUnique({ where: { organization_id: id } });
  if (!credential) return { ok: false, error: "This organization has no SFTP password yet." };
  const password = newPassword();
  let host: string | null = null;
  let note: string | null = null;
  try {
    host = await transferHost();
  } catch (error) {
    note = error instanceof Error ? error.message : "The Transfer host could not be read.";
  }
  await prisma.$transaction([
    prisma.sftpCredential.update({
      where: { organization_id: id },
      data: { password_hash: hashSecret(password) },
    }),
    prisma.auditLog.create({
      data: {
        organization_id: id,
        event: "sftp.password_rotated",
        detail: { admin_user_id: admin.userId },
      },
    }),
  ]);
  return { ok: true, issued: { host, username: String(id), password, note } };
}

async function approveSftp(
  admin: Admin,
  request: RequestRecord,
): Promise<ActionResult> {
  if (request.action === "enable") {
    const host = await transferHost();
    try {
      await ensureUploadPrefix(request.organization_id);
    } catch (error) {
      if (error instanceof AdminError) throw error;
      throw new AdminError("The upload folder could not be created. Check AWS credentials and the invoice bucket.");
    }
    const existing = await prisma.sftpCredential.findUnique({
      where: { organization_id: request.organization_id },
      select: { organization_id: true },
    });
    const password = existing ? null : newPassword();
    const decidedAt = new Date();
    await prisma.$transaction(async (tx) => {
      if (password) {
        await tx.sftpCredential.create({
          data: { organization_id: request.organization_id, password_hash: hashSecret(password) },
        });
      }
      if (request.connection.status !== "live") {
        await tx.erpConnection.update({ where: { id: request.connection.id }, data: { status: "live" } });
      }
      await tx.erpChangeRequest.update({
        where: { id: request.id },
        data: { status: "approved", decided_at: decidedAt },
      });
      await tx.auditLog.create({
        data: {
          organization_id: request.organization_id,
          event: "erp.enabled",
          detail: detail(admin, "sftp", request),
        },
      });
    });
    const issued: IssuedPassword | null = password
      ? { host, username: String(request.organization_id), password, note: null }
      : null;
    return {
      ok: true,
      issued,
      message: password ? null : "Password already issued. Use Rotate to replace it.",
    };
  }
  await prisma.$transaction([
    prisma.erpConnection.update({ where: { id: request.connection.id }, data: { status: "offline" } }),
    prisma.erpChangeRequest.update({
      where: { id: request.id },
      data: { status: "approved", decided_at: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        organization_id: request.organization_id,
        event: "erp.disabled",
        detail: detail(admin, "sftp", request),
      },
    }),
  ]);
  return { ok: true };
}

async function approvePoll(admin: Admin, request: RequestRecord): Promise<ActionResult> {
  const decidedAt = new Date();
  await prisma.$transaction(async (tx) => {
    if (request.action === "enable") {
      await tx.organization.update({
        where: { id: request.organization_id },
        data: { polling_enabled: true },
      });
      if (request.connection.status !== "live") {
        await tx.erpConnection.update({ where: { id: request.connection.id }, data: { status: "live" } });
      }
    } else {
      await tx.erpConnection.update({ where: { id: request.connection.id }, data: { status: "offline" } });
      const remaining = await tx.erpConnection.count({
        where: {
          organization_id: request.organization_id,
          ingestion_mode: "poll",
          status: "live",
        },
      });
      if (remaining === 0) {
        await tx.organization.update({
          where: { id: request.organization_id },
          data: { polling_enabled: false },
        });
      }
    }
    await tx.erpChangeRequest.update({
      where: { id: request.id },
      data: { status: "approved", decided_at: decidedAt },
    });
    await tx.auditLog.create({
      data: {
        organization_id: request.organization_id,
        event: request.action === "enable" ? "erp.enabled" : "erp.disabled",
        detail: detail(admin, "poll", request),
      },
    });
  });
  return { ok: true };
}

type RequestRecord = {
  id: bigint;
  organization_id: bigint;
  action: string;
  connection: { id: bigint; erp_code: string; status: string; ingestion_mode: string; label: string | null };
};

function detail(admin: Admin, ingestionMode: string, request: RequestRecord) {
  return {
    ingestionMode,
    erp: request.connection.erp_code,
    label: request.connection.label,
    connectionId: String(request.connection.id),
    requestId: String(request.id),
    action: request.action,
    admin_user_id: admin.userId,
  };
}

function organizationKey(id: string): bigint | null {
  return /^\d+$/.test(id) ? BigInt(id) : null;
}

function requiredText(value: string, message: string, max: number): string {
  const text = value.trim();
  if (!text || text.length > max) throw new AdminError(message);
  return text;
}

function optionalText(value: string, max: number): string | null {
  const text = value.trim();
  if (!text) return null;
  if (text.length > max) throw new AdminError("That value is too long.");
  return text;
}

function normalizeEntities(entities: OnboardInput["entities"]): ActionResult & { entities?: NormalizedEntity[] } {
  if (!Array.isArray(entities) || entities.length === 0) {
    return { ok: false, error: "Add at least one legal entity." };
  }
  const normalized: NormalizedEntity[] = [];
  const tins = new Set<string>();
  for (const entity of entities) {
    const name = entity.name?.trim() ?? "";
    const tin = entity.tin?.trim() ?? "";
    if (!name || name.length > 160) return { ok: false, error: "Enter each legal entity name." };
    if (!isTin(tin)) return { ok: false, error: "Each TIN must be 9 digits." };
    if (tins.has(tin)) return { ok: false, error: "Each legal entity needs its own TIN." };
    tins.add(tin);
    if (!Array.isArray(entity.branches) || entity.branches.length === 0) {
      return { ok: false, error: "Each legal entity needs a branch." };
    }
    const codes = new Set<string>();
    const branches = [];
    for (const branch of entity.branches) {
      const code = branch.code?.trim() ?? "";
      const branchName = branch.name?.trim() ?? "";
      if (!isBranchCode(code)) return { ok: false, error: "Branch code must be 1 to 15 letters or digits." };
      if (!branchName || branchName.length > 160) return { ok: false, error: "Enter each branch name." };
      const folded = code.toUpperCase();
      if (codes.has(folded)) return { ok: false, error: "Branch codes must be unique within a legal entity." };
      codes.add(folded);
      branches.push({ code, name: branchName });
    }
    const vat = entity.vatNumber?.trim() ?? "";
    if (vat.length > 40) return { ok: false, error: "VAT number is too long." };
    normalized.push({ name, tin, vatNumber: vat || null, branches });
  }
  return { ok: true, entities: normalized };
}

type NormalizedEntity = {
  name: string;
  tin: string;
  vatNumber: string | null;
  branches: Array<{ code: string; name: string }>;
};
