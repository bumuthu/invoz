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
import { seeds, seedTables, type SeedDocument, type SeedRow } from "../seeders";

const refs = new Map<string, string>();

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
]);

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
    case "field_mappings":
      return tx.fieldMapping.create({ data: data as Prisma.FieldMappingUncheckedCreateInput });
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

  const created = await createRow(tx, table, data);
  if (ref) {
    if (refs.has(ref)) {
      throw new Error(`duplicate seed ref ${ref}`);
    }
    if (!("id" in created)) {
      throw new Error(`${table} cannot use ref because it has no id column`);
    }
    refs.set(ref, String(created.id));
  }

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
      console.log(`seeded auth user ${email}`);
    }
  }
}

function assertKnownKeys(document: SeedDocument): void {
  const known = new Set<string>(["auth_users", ...seedTables]);
  for (const key of Object.keys(document)) {
    if (!known.has(key)) {
      throw new Error(`unknown seed key ${key}`);
    }
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required. Run npm run migrate before this script.");
  }
  if (seeds.length === 0) {
    throw new Error("supabase/seeders has no seed objects");
  }

  for (const document of seeds) {
    assertKnownKeys(document);
  }

  await seedAuthUsers(seeds);
  await prisma.$transaction(
    async (tx) => {
      for (const table of seedTables) {
        for (const document of seeds) {
          for (const row of document[table] ?? []) {
            await insertRow(tx, table, row);
          }
        }
      }
    },
    { timeout: 60_000, maxWait: 10_000 },
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
