import {
  assertBranchCode,
  assertOrganizationSlug,
  assertPositiveInt,
  assertTin,
  portalRoles,
  tableColumns,
  type TableName,
} from "@invoz/common";
import { prisma, type Prisma } from "@invoz/database";
import { createClient } from "@supabase/supabase-js";
import { seedTables, type SeedDocument, type SeedRow } from "../seeders";

const refs = new Map<string, string>();

const dateOnly = /^\d{4}-\d{2}-\d{2}$/;

const bigintColumns = new Set([
  "id",
  "organization_id",
  "legal_entity_id",
  "branch_id",
  "original_invoice_id",
  "outbound_invoice_id",
  "outbound_adjustment_id",
  "inbound_invoice_id",
  "inbound_adjustment_id",
  "erp_connection_id",
]);

type KeptRow = {
  id?: string;
  role?: string;
  user_id?: string;
};

function rowId(row: object): string | undefined {
  if (!("id" in row)) {
    return undefined;
  }
  const id = (row as { id: unknown }).id;
  if (typeof id === "bigint" || typeof id === "number" || typeof id === "string") {
    return String(id);
  }
  return undefined;
}

function kept(row: object | null): KeptRow | null {
  if (!row) {
    return null;
  }
  const role = "role" in row && typeof row.role === "string" ? row.role : undefined;
  const userId = "user_id" in row && typeof row.user_id === "string" ? row.user_id : undefined;
  return { id: rowId(row), role, user_id: userId };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolve(column: string, value: unknown): unknown {
  if ((column === "user_id" || column.endsWith("_id")) && typeof value === "string" && refs.has(value)) {
    return refs.get(value);
  }
  if (isRecord(value) || Array.isArray(value)) {
    return value;
  }
  return value;
}

function cell(column: string, value: unknown): unknown {
  const resolved = resolve(column, value);
  if (
    bigintColumns.has(column) &&
    resolved !== null &&
    resolved !== undefined &&
    (typeof resolved === "number" || typeof resolved === "string")
  ) {
    return BigInt(resolved);
  }
  if (typeof resolved === "string" && dateOnly.test(resolved)) {
    return new Date(`${resolved}T00:00:00.000Z`);
  }
  return resolved;
}

function checkRow(table: TableName, row: Record<string, unknown>): void {
  if (table === "organizations" && typeof row.slug === "string") {
    assertOrganizationSlug(row.slug);
  }
  if (typeof row.monthly_allowance === "number") {
    assertPositiveInt(row.monthly_allowance, "monthly_allowance");
  }
  if (typeof row.tin === "string") {
    assertTin(row.tin);
  }
  if (typeof row.customer_tin === "string") {
    assertTin(row.customer_tin);
  }
  if (typeof row.supplier_tin === "string") {
    assertTin(row.supplier_tin);
  }
  if (typeof row.code === "string" && table === "branches") {
    assertBranchCode(row.code);
  }
  if (table === "memberships" && typeof row.role === "string" && !(portalRoles as readonly string[]).includes(row.role)) {
    throw new Error("memberships.role must be a portal role");
  }
}

function requiredBigInt(data: Record<string, unknown>, key: string): bigint {
  const value = data[key];
  if (typeof value !== "bigint") {
    throw new Error(`${key} is required`);
  }
  return value;
}

function requiredString(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  if (typeof value !== "string" || value === "") {
    throw new Error(`${key} is required`);
  }
  return value;
}

function optionalBigInt(data: Record<string, unknown>, key: string): bigint | null {
  const value = data[key];
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === "bigint") {
    return value;
  }
  throw new Error(`${key} must be an id`);
}

function optionalString(data: Record<string, unknown>, key: string): string | null {
  const value = data[key];
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  throw new Error(`${key} must be a string`);
}

function requiredDate(data: Record<string, unknown>, key: string): Date {
  const value = data[key];
  if (value instanceof Date) {
    return value;
  }
  throw new Error(`${key} is required`);
}

async function findExisting(
  tx: Prisma.TransactionClient,
  table: TableName,
  data: Record<string, unknown>,
): Promise<KeptRow | null> {
  switch (table) {
    case "organizations":
      return kept(await tx.organization.findUnique({ where: { slug: requiredString(data, "slug") } }));
    case "legal_entities":
      return kept(
        await tx.legalEntity.findUnique({
          where: {
            organization_id_tin: {
              organization_id: requiredBigInt(data, "organization_id"),
              tin: requiredString(data, "tin"),
            },
          },
        }),
      );
    case "branches":
      return kept(
        await tx.branch.findUnique({
          where: {
            legal_entity_id_code: {
              legal_entity_id: requiredBigInt(data, "legal_entity_id"),
              code: requiredString(data, "code"),
            },
          },
        }),
      );
    case "memberships":
      return kept(
        await tx.membership.findUnique({
          where: {
            user_id_organization_id: {
              user_id: requiredString(data, "user_id"),
              organization_id: requiredBigInt(data, "organization_id"),
            },
          },
        }),
      );
    case "erp_connections": {
      const rows = await tx.erpConnection.findMany({
        where: {
          organization_id: requiredBigInt(data, "organization_id"),
          legal_entity_id: optionalBigInt(data, "legal_entity_id"),
          erp_code: requiredString(data, "erp_code"),
          label: optionalString(data, "label"),
          ingestion_mode: optionalString(data, "ingestion_mode") ?? "sftp",
          endpoint_url: optionalString(data, "endpoint_url"),
        },
      });
      if (rows.length > 1) {
        throw new Error("erp connection matches more than one row");
      }
      return kept(rows[0] ?? null);
    }
    case "erp_change_requests":
      return kept(
        await tx.erpChangeRequest.findFirst({
          where: {
            erp_connection_id: requiredBigInt(data, "erp_connection_id"),
            organization_id: requiredBigInt(data, "organization_id"),
            user_id: requiredString(data, "user_id"),
            action: requiredString(data, "action"),
            status: optionalString(data, "status") ?? "pending",
          },
        }),
      );
    case "erp_field_mappings":
      return kept(
        await tx.erpFieldMapping.findUnique({
          where: {
            erp_code_schedule: {
              erp_code: requiredString(data, "erp_code"),
              schedule: requiredString(data, "schedule"),
            },
          },
        }),
      );
    case "ramis_credentials":
      return kept(
        await tx.ramisCredential.findUnique({
          where: { legal_entity_id: requiredBigInt(data, "legal_entity_id") },
        }),
      );
    case "serial_counters":
      return kept(
        await tx.serialCounter.findUnique({
          where: {
            branch_id_period: {
              branch_id: requiredBigInt(data, "branch_id"),
              period: requiredString(data, "period"),
            },
          },
        }),
      );
    case "outbound_invoices":
      return kept(
        await tx.outboundInvoice.findUnique({
          where: {
            legal_entity_id_erp_reference: {
              legal_entity_id: requiredBigInt(data, "legal_entity_id"),
              erp_reference: requiredString(data, "erp_reference"),
            },
          },
        }),
      );
    case "outbound_adjustments":
      return kept(
        await tx.outboundAdjustment.findUnique({
          where: {
            legal_entity_id_erp_reference: {
              legal_entity_id: requiredBigInt(data, "legal_entity_id"),
              erp_reference: requiredString(data, "erp_reference"),
            },
          },
        }),
      );
    case "invoice_usage":
      return kept(
        await tx.invoiceUsage.findUnique({
          where: {
            organization_id_period: {
              organization_id: requiredBigInt(data, "organization_id"),
              period: requiredDate(data, "period"),
            },
          },
        }),
      );
    case "inbound_invoices":
      return kept(
        await tx.inboundInvoice.findUnique({
          where: {
            legal_entity_id_supplier_tin_supplier_invoice_number: {
              legal_entity_id: requiredBigInt(data, "legal_entity_id"),
              supplier_tin: requiredString(data, "supplier_tin"),
              supplier_invoice_number: requiredString(data, "supplier_invoice_number"),
            },
          },
        }),
      );
    case "inbound_adjustments":
      return kept(
        await tx.inboundAdjustment.findUnique({
          where: {
            legal_entity_id_supplier_tin_adjustment_serial_number: {
              legal_entity_id: requiredBigInt(data, "legal_entity_id"),
              supplier_tin: requiredString(data, "supplier_tin"),
              adjustment_serial_number: requiredString(data, "adjustment_serial_number"),
            },
          },
        }),
      );
    case "audit_logs":
      return kept(
        await tx.auditLog.findFirst({
          where: {
            organization_id: requiredBigInt(data, "organization_id"),
            event: requiredString(data, "event"),
            legal_entity_id: optionalBigInt(data, "legal_entity_id"),
            detail: { equals: (data.detail ?? {}) as Prisma.InputJsonValue },
          },
        }),
      );
  }
}

function remember(table: TableName, ref: string | undefined, row: object): void {
  if (!ref) {
    return;
  }
  if (refs.has(ref)) {
    throw new Error(`duplicate seed ref ${ref}`);
  }
  const id = rowId(row);
  if (id === undefined) {
    throw new Error(`${table} cannot use ref because it has no id column`);
  }
  refs.set(ref, id);
}

async function createRow(tx: Prisma.TransactionClient, table: TableName, data: Record<string, unknown>) {
  switch (table) {
    case "organizations":
      return tx.organization.create({ data: data as Prisma.OrganizationUncheckedCreateInput });
    case "legal_entities":
      return tx.legalEntity.create({ data: data as Prisma.LegalEntityUncheckedCreateInput });
    case "branches":
      return tx.branch.create({ data: data as Prisma.BranchUncheckedCreateInput });
    case "memberships":
      return tx.membership.create({ data: data as Prisma.MembershipUncheckedCreateInput });
    case "erp_connections":
      return tx.erpConnection.create({ data: data as Prisma.ErpConnectionUncheckedCreateInput });
    case "erp_change_requests":
      return tx.erpChangeRequest.create({ data: data as Prisma.ErpChangeRequestUncheckedCreateInput });
    case "erp_field_mappings":
      return tx.erpFieldMapping.create({ data: data as Prisma.ErpFieldMappingUncheckedCreateInput });
    case "ramis_credentials":
      return tx.ramisCredential.create({ data: data as Prisma.RamisCredentialUncheckedCreateInput });
    case "serial_counters":
      return tx.serialCounter.create({ data: data as Prisma.SerialCounterUncheckedCreateInput });
    case "outbound_invoices":
      return tx.outboundInvoice.create({ data: data as Prisma.OutboundInvoiceUncheckedCreateInput });
    case "outbound_adjustments":
      return tx.outboundAdjustment.create({ data: data as Prisma.OutboundAdjustmentUncheckedCreateInput });
    case "invoice_usage":
      return tx.invoiceUsage.create({ data: data as Prisma.InvoiceUsageUncheckedCreateInput });
    case "inbound_invoices":
      return tx.inboundInvoice.create({ data: data as Prisma.InboundInvoiceUncheckedCreateInput });
    case "inbound_adjustments":
      return tx.inboundAdjustment.create({ data: data as Prisma.InboundAdjustmentUncheckedCreateInput });
    case "audit_logs":
      return tx.auditLog.create({ data: data as Prisma.AuditLogUncheckedCreateInput });
  }
}

async function insertRow(tx: Prisma.TransactionClient, table: TableName, row: SeedRow<TableName>): Promise<void> {
  const source = row as Record<string, unknown>;
  const ref = typeof source.ref === "string" ? source.ref : undefined;
  const allowed = new Set<string>(tableColumns[table]);
  const data: Record<string, unknown> = {};

  checkRow(table, source);

  for (const [key, value] of Object.entries(source)) {
    if (key === "ref" || value === undefined) {
      continue;
    }
    if (!allowed.has(key)) {
      throw new Error(`${table}.${key} is not a column`);
    }
    data[key] = cell(key, value);
  }

  if (Object.keys(data).length === 0) {
    throw new Error(`${table} row has no columns`);
  }
  if (ref && !allowed.has("id")) {
    throw new Error(`${table} cannot use ref because it has no id column`);
  }

  if (table === "memberships" && data.role === "owner") {
    const owner = await tx.membership.findFirst({
      where: {
        organization_id: requiredBigInt(data, "organization_id"),
        role: "owner",
      },
    });
    if (owner && owner.user_id !== requiredString(data, "user_id")) {
      throw new Error("organization already has a different owner");
    }
  }

  const existing = await findExisting(tx, table, data);
  if (existing) {
    if (table === "memberships" && existing.role !== undefined && existing.role !== String(data.role)) {
      throw new Error(`membership already has role ${existing.role}`);
    }
    remember(table, ref, existing);
    console.log(`kept ${table}${ref ? ` ${ref}` : ""}`);
    return;
  }

  const created = await createRow(tx, table, data);
  remember(table, ref, created);
  console.log(`seeded ${table}${ref ? ` ${ref}` : ""}`);
}

async function authUserId(email: string, password: string, userName?: string): Promise<string> {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to create an Auth user");
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const created = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: userName ? { name: userName } : undefined,
  });
  if (created.error || !created.data.user) {
    throw new Error(created.error?.message ?? "Auth user was not created");
  }
  return created.data.user.id;
}

async function seedAuthUsers(documents: SeedDocument[]): Promise<void> {
  for (const document of documents) {
    for (const user of document.auth_users ?? []) {
      const email = user.email.toLowerCase();
      const existing = await prisma.$queryRaw<{ id: string }[]>`
        select id from auth.users where lower(email) = ${email}
      `;
      const userId = existing[0]?.id ?? (await authUserId(email, user.password, user.name));
      if (user.ref) {
        if (refs.has(user.ref)) {
          throw new Error(`duplicate seed ref ${user.ref}`);
        }
        refs.set(user.ref, userId);
      }
      refs.set(email, userId);
      console.log(existing[0]?.id ? `auth user ${email} already exists` : `seeded auth user ${email}`);
    }
  }
}

export async function applySeeds(documents: SeedDocument[]): Promise<void> {
  refs.clear();
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required. Run npm run migrate before this script.");
  }
  if (documents.length === 0) {
    throw new Error("supabase/seeders has no organizations");
  }

  await seedAuthUsers(documents);
  await prisma.$transaction(
    async (tx) => {
      for (const table of seedTables) {
        for (const document of documents) {
          for (const row of document[table] ?? []) {
            await insertRow(tx, table, row);
          }
        }
      }
    },
    { timeout: 60_000, maxWait: 10_000 },
  );
}
