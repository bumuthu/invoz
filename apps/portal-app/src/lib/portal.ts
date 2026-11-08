import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { formatGazetteSerial, portalRoleLabel, portalRoles, type PortalRole } from "@invoz/common";
import {
  branchRow,
  invoiceUsageRow,
  legalEntityRow,
  membershipRow,
  Prisma,
  prisma,
  serialCounterRow,
} from "@invoz/database";
import { permissions, resolveAccess } from "@/lib/access";
import { portalRootDomain } from "@/lib/host";
import {
  aggregateMetrics,
  buildDocuments,
  buildGapsFromSerials,
  formatDate,
  formatMoney,
  formatStamp,
  monthTitle,
  type PortalAdjustmentSource,
  type PortalInvoiceSource,
  type ScopedDocument,
} from "@/lib/documents";
import { erpCatalog, erpName } from "@/lib/erps";
import { monthRange, writeFilters } from "@/lib/filters";
import { supabase } from "@/lib/supabase";
import type {
  AuditEvent,
  BranchView,
  ErpConnectionView,
  Invoice,
  PipelineCounts,
  ScheduleRow,
} from "@/lib/types";

const gazetteMonths = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const classOrder = ["standard", "financial_services", "zero_rated", "exempt"];

const invoiceSelect = {
  id: true,
  created_at: true,
  serial_number: true,
  customer_name: true,
  customer_tin: true,
  invoice_date: true,
  supply_date: true,
  amount_exclusive_vat: true,
  vat_amount: true,
  total_amount: true,
  ramis_status: true,
  branch_id: true,
  legal_entity_id: true,
  error_message: true,
  ramis_clearance_token: true,
  invoice_type: true,
} satisfies Prisma.OutboundInvoiceSelect;

const adjustmentSelect = {
  id: true,
  created_at: true,
  serial_number: true,
  adjustment_type: true,
  customer_name: true,
  customer_tin: true,
  reason: true,
  adjustment_date: true,
  adjusted_amount_exclusive_vat: true,
  adjusted_vat_amount: true,
  adjusted_total_amount: true,
  ramis_status: true,
  branch_id: true,
  legal_entity_id: true,
  error_message: true,
  ramis_clearance_token: true,
  original_invoice_id: true,
  original_serial_number: true,
  original_invoice_date: true,
  originalInvoice: { select: { customer_name: true, customer_tin: true, invoice_type: true } },
} satisfies Prisma.OutboundAdjustmentSelect;

const inboundSelect = {
  id: true,
  legal_entity_id: true,
  supplier_name: true,
  supplier_tin: true,
  supplier_invoice_number: true,
  amount_exclusive_vat: true,
  vat_amount: true,
  erp_voucher_reference: true,
  matching_status: true,
  is_approved_for_input_vat: true,
  invoice_date: true,
} satisfies Prisma.InboundInvoiceSelect;

function asRole(role: string): PortalRole {
  if (!(portalRoles as readonly string[]).includes(role)) {
    throw new Error(`membership role ${role} is not a portal role`);
  }
  return role as PortalRole;
}

function periodRank(period: string): number {
  return Number(period.slice(0, 2)) * 12 + gazetteMonths.indexOf(period.slice(2));
}

function gazettePeriod(period: string): string | null {
  if (!/^\d{4}-\d{2}$/.test(period)) return null;
  const [year, month] = period.split("-").map(Number);
  return `${String(year).slice(-2)}${gazetteMonths[month - 1]}`;
}

function branchKey(entityId: number, code: string): string {
  return `${entityId}:${code}`;
}

function day(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function money(value: { toFixed(digits: number): string }): string {
  return value.toFixed(2);
}

function amount(value: { toNumber(): number } | null | undefined): number {
  return value ? value.toNumber() : 0;
}

function documentKey(value: string): { kind: "invoice" | "adjustment"; id: bigint } | null {
  const invoice = /^invoice-(\d+)$/.exec(value);
  if (invoice?.[1]) return { kind: "invoice", id: BigInt(invoice[1]) };
  const adjustment = /^adjustment-(\d+)$/.exec(value);
  if (adjustment?.[1]) return { kind: "adjustment", id: BigInt(adjustment[1]) };
  return null;
}

const loadScope = cache(async () => {
  const access = await resolveAccess();
  const filters = access.filters;
  const organizationId = BigInt(access.organization.id);
  const flags = permissions(access.role);

  const entities = (
    await prisma.legalEntity.findMany({
      where: { organization_id: organizationId },
      orderBy: { name: "asc" },
    })
  ).map(legalEntityRow);
  if (entities.length === 0) {
    throw new Error(`${access.organization.name} has no legal entity`);
  }

  const selectedEntities =
    filters.entityId === "all" ? entities : entities.filter((entity) => String(entity.id) === filters.entityId);
  const scopedEntities = selectedEntities.length > 0 ? selectedEntities : entities;
  const appliedFilters =
    filters.entityId !== "all" && selectedEntities.length === 0 ? { ...filters, entityId: "all" } : filters;
  const entityIds = scopedEntities.map((entity) => BigInt(entity.id));
  const branches = (
    await prisma.branch.findMany({
      where: { legal_entity_id: { in: entityIds } },
      orderBy: { name: "asc" },
    })
  ).map(branchRow);
  const showOrganization = !access.hostPinned && access.organizations.length > 1;

  return {
    access,
    flags,
    organizationId,
    entities,
    appliedFilters,
    entityIds,
    branches,
    query: writeFilters(appliedFilters, String(access.organization.id), showOrganization),
  };
});

type Scope = Awaited<ReturnType<typeof loadScope>>;

const loadContext = cache(async () => {
  const scope = await loadScope();
  const [invoiceDateRows, adjustmentDateRows, inboundDateRows] = await Promise.all([
    prisma.outboundInvoice.findMany({
      where: { organization_id: scope.organizationId, legal_entity_id: { in: scope.entityIds } },
      select: { invoice_date: true },
      distinct: ["invoice_date"],
    }),
    prisma.outboundAdjustment.findMany({
      where: { organization_id: scope.organizationId, legal_entity_id: { in: scope.entityIds } },
      select: { adjustment_date: true },
      distinct: ["adjustment_date"],
    }),
    prisma.inboundInvoice.findMany({
      where: { organization_id: scope.organizationId, legal_entity_id: { in: scope.entityIds } },
      select: { invoice_date: true },
      distinct: ["invoice_date"],
    }),
  ]);
  const periods = [
    ...new Set(
      [
        ...invoiceDateRows.map((row) => row.invoice_date.toISOString().slice(0, 7)),
        ...adjustmentDateRows.map((row) => row.adjustment_date.toISOString().slice(0, 7)),
        ...inboundDateRows.map((row) => row.invoice_date.toISOString().slice(0, 7)),
      ].filter((period) => period !== ""),
    ),
  ].sort((left, right) => (left < right ? 1 : -1));

  return { ...scope, periods };
});

function organizationOf(scope: Pick<Scope, "access">) {
  return {
    id: String(scope.access.organization.id),
    name: scope.access.organization.name,
  };
}

function shellFrom(ctx: Awaited<ReturnType<typeof loadContext>>, requestHost: string) {
  const { access, entities, branches, periods, appliedFilters, query } = ctx;
  const root = portalRootDomain(requestHost);
  const entityName = new Map(entities.map((entity) => [entity.id, entity.name]));
  return {
    organization: {
      ...organizationOf(ctx),
      slug: access.organization.slug,
      host: root ? `${access.organization.slug}.${root}` : requestHost,
      monthlyAllowance: access.organization.monthly_allowance,
    },
    organizations: access.organizations.map((organization) => ({
      id: String(organization.id),
      name: organization.name,
    })),
    hostPinned: access.hostPinned,
    currentUser: {
      name: access.name,
      email: access.email,
      role: portalRoleLabel(access.role),
      roleKey: access.role,
    },
    canAudit: ctx.flags.canAudit,
    entities: entities.map((entity) => ({
      id: String(entity.id),
      name: entity.name,
      tin: entity.tin,
    })),
    branches: branches.map((branch) => ({
      id: branchKey(branch.legal_entity_id, branch.code),
      code: branch.code,
      name: branch.name,
      entityId: String(branch.legal_entity_id),
      entity: entityName.get(branch.legal_entity_id) ?? String(branch.legal_entity_id),
      nextSerial: "—",
    })),
    periods,
    filters: appliedFilters,
    query,
  };
}

export const loadShell = cache(async () => {
  const requestHost = (await headers()).get("host")?.split(":")[0] ?? "";
  return shellFrom(await loadContext(), requestHost);
});

function view(scope: Scope) {
  const range = monthRange(scope.appliedFilters.period);
  const selectedBranch = scope.branches.filter(
    (branch) => branchKey(branch.legal_entity_id, branch.code) === scope.appliedFilters.branch,
  );
  const branchIds =
    scope.appliedFilters.branch === "all" ? null : selectedBranch.map((branch) => BigInt(branch.id));
  const shared = {
    organization_id: scope.organizationId,
    legal_entity_id: { in: scope.entityIds },
    ...(branchIds ? { branch_id: { in: branchIds } } : {}),
  };
  const invoiceWhere: Prisma.OutboundInvoiceWhereInput = {
    ...shared,
    ...(range ? { invoice_date: range } : {}),
  };
  const adjustmentWhere: Prisma.OutboundAdjustmentWhereInput = {
    ...shared,
    ...(range ? { adjustment_date: range } : {}),
  };
  const purchaseWhere: Prisma.InboundInvoiceWhereInput = {
    organization_id: scope.organizationId,
    legal_entity_id: { in: scope.entityIds },
    ...(range ? { invoice_date: range } : {}),
  };
  return { invoiceWhere, adjustmentWhere, purchaseWhere };
}

function lookupNames(scope: Scope) {
  return {
    entityName: new Map(scope.entities.map((entity) => [entity.id, entity.name])),
    branchCode: new Map(scope.branches.map((branch) => [branch.id, branch.code])),
    branchName: new Map(scope.branches.map((branch) => [branch.id, branch.name])),
  };
}

function present(documents: ScopedDocument[]): Invoice[] {
  return documents.map(
    ({
      invoiceClass: _class,
      netValue: _net,
      vatValue: _vat,
      totalValue: _total,
      cleared: _cleared,
      day: _day,
      month: _month,
      ...invoice
    }) => invoice,
  );
}

function toInvoiceSource(row: Prisma.OutboundInvoiceGetPayload<{ select: typeof invoiceSelect }>): PortalInvoiceSource {
  return {
    id: Number(row.id),
    created_at: row.created_at.toISOString(),
    serial_number: row.serial_number,
    customer_name: row.customer_name,
    customer_tin: row.customer_tin,
    invoice_date: day(row.invoice_date),
    supply_date: day(row.supply_date),
    amount_exclusive_vat: money(row.amount_exclusive_vat),
    vat_amount: money(row.vat_amount),
    total_amount: money(row.total_amount),
    ramis_status: row.ramis_status,
    branch_id: Number(row.branch_id),
    legal_entity_id: Number(row.legal_entity_id),
    error_message: row.error_message,
    ramis_clearance_token: row.ramis_clearance_token,
    invoice_type: row.invoice_type,
  };
}

function toAdjustmentSource(
  row: Prisma.OutboundAdjustmentGetPayload<{ select: typeof adjustmentSelect }>,
): PortalAdjustmentSource {
  return {
    id: Number(row.id),
    created_at: row.created_at.toISOString(),
    serial_number: row.serial_number,
    adjustment_type: row.adjustment_type,
    customer_name: row.customer_name,
    customer_tin: row.customer_tin,
    reason: row.reason,
    adjustment_date: day(row.adjustment_date),
    adjusted_amount_exclusive_vat: money(row.adjusted_amount_exclusive_vat),
    adjusted_vat_amount: money(row.adjusted_vat_amount),
    adjusted_total_amount: money(row.adjusted_total_amount),
    ramis_status: row.ramis_status,
    branch_id: Number(row.branch_id),
    legal_entity_id: Number(row.legal_entity_id),
    error_message: row.error_message,
    ramis_clearance_token: row.ramis_clearance_token,
    original_invoice_id: Number(row.original_invoice_id),
    original_serial_number: row.original_serial_number,
    original_invoice_date: day(row.original_invoice_date),
    original_customer_name: row.originalInvoice.customer_name,
    original_customer_tin: row.originalInvoice.customer_tin,
    original_invoice_type: row.originalInvoice.invoice_type,
  };
}

async function invoiceSources(where: Prisma.OutboundInvoiceWhereInput, take?: number) {
  const rows = await prisma.outboundInvoice.findMany({
    where,
    select: invoiceSelect,
    ...(take ? { orderBy: { created_at: "desc" as const }, take } : {}),
  });
  return rows.map(toInvoiceSource);
}

async function adjustmentSources(where: Prisma.OutboundAdjustmentWhereInput, take?: number) {
  const rows = await prisma.outboundAdjustment.findMany({
    where,
    select: adjustmentSelect,
    ...(take ? { orderBy: { created_at: "desc" as const }, take } : {}),
  });
  return rows.map(toAdjustmentSource);
}

function toScheduleRow(
  row: Prisma.InboundInvoiceGetPayload<{ select: typeof inboundSelect }>,
  entityName: Map<number, string>,
): ScheduleRow {
  return {
    id: String(row.id),
    supplier: row.supplier_name,
    tin: row.supplier_tin,
    serial: row.supplier_invoice_number,
    amount: formatMoney(money(row.amount_exclusive_vat)),
    vat: formatMoney(money(row.vat_amount)),
    voucher: row.erp_voucher_reference,
    match: row.matching_status,
    approved: row.is_approved_for_input_vat,
    invoiceDate: formatDate(day(row.invoice_date)),
    entity: entityName.get(Number(row.legal_entity_id)) ?? String(row.legal_entity_id),
  };
}

async function purchaseRows(where: Prisma.InboundInvoiceWhereInput, entityName: Map<number, string>) {
  const rows = await prisma.inboundInvoice.findMany({ where, select: inboundSelect });
  return rows.map((row) => toScheduleRow(row, entityName));
}

function pipelineFrom(
  groups: Array<{ ramis_status: string; _count: { _all: number } }>,
): PipelineCounts {
  const pipeline: PipelineCounts = { cleared: 0, submitting: 0, rejected: 0, skipped: 0 };
  for (const row of groups) {
    const count = row._count._all;
    if (row.ramis_status === "cleared") pipeline.cleared += count;
    else if (row.ramis_status === "rejected") pipeline.rejected += count;
    else if (row.ramis_status === "skipped_non_vat") pipeline.skipped += count;
    else if (row.ramis_status === "queued" || row.ramis_status === "validated" || row.ramis_status === "draft") {
      pipeline.submitting += count;
    } else {
      throw new Error(`ramis status ${row.ramis_status} has no portal label`);
    }
  }
  return pipeline;
}

async function statusPipeline(
  invoiceWhere: Prisma.OutboundInvoiceWhereInput,
  adjustmentWhere: Prisma.OutboundAdjustmentWhereInput,
) {
  const [invoiceGroups, adjustmentGroups] = await Promise.all([
    prisma.outboundInvoice.groupBy({ by: ["ramis_status"], where: invoiceWhere, _count: { _all: true } }),
    prisma.outboundAdjustment.groupBy({ by: ["ramis_status"], where: adjustmentWhere, _count: { _all: true } }),
  ]);
  return pipelineFrom([...invoiceGroups, ...adjustmentGroups]);
}

async function findLatestMonth(
  invoiceWhere: Prisma.OutboundInvoiceWhereInput,
  adjustmentWhere: Prisma.OutboundAdjustmentWhereInput,
) {
  const [invoice, adjustment] = await Promise.all([
    prisma.outboundInvoice.findFirst({
      where: invoiceWhere,
      orderBy: { invoice_date: "desc" },
      select: { invoice_date: true },
    }),
    prisma.outboundAdjustment.findFirst({
      where: adjustmentWhere,
      orderBy: { adjustment_date: "desc" },
      select: { adjustment_date: true },
    }),
  ]);
  return [invoice?.invoice_date, adjustment?.adjustment_date]
    .filter((value): value is Date => Boolean(value))
    .map((value) => value.toISOString().slice(0, 7))
    .sort()
    .at(-1) ?? "";
}

async function flagDuplicateSerials(
  documents: ScopedDocument[],
  invoiceWhere: Prisma.OutboundInvoiceWhereInput,
  adjustmentWhere: Prisma.OutboundAdjustmentWhereInput,
) {
  const serials = [...new Set(documents.map((document) => document.serial).filter((serial) => serial !== "—"))];
  if (serials.length === 0) return;
  const [invoices, adjustments] = await Promise.all([
    prisma.outboundInvoice.groupBy({
      by: ["legal_entity_id", "serial_number"],
      where: { AND: [invoiceWhere, { serial_number: { in: serials } }] },
      _count: { _all: true },
    }),
    prisma.outboundAdjustment.groupBy({
      by: ["legal_entity_id", "serial_number"],
      where: { AND: [adjustmentWhere, { serial_number: { in: serials } }] },
      _count: { _all: true },
    }),
  ]);
  const counts = new Map<string, number>();
  for (const row of [...invoices, ...adjustments]) {
    if (!row.serial_number) continue;
    const key = `${Number(row.legal_entity_id)}:${row.serial_number}`;
    counts.set(key, (counts.get(key) ?? 0) + row._count._all);
  }
  for (const document of documents) {
    if ((counts.get(`${document.entityId}:${document.serial}`) ?? 0) > 1 && !document.tags.includes("DUPLICATE_SERIAL")) {
      document.tags.push("DUPLICATE_SERIAL");
    }
  }
}

const loadGapRows = cache(async () => {
  const scope = await loadScope();
  const { invoiceWhere, adjustmentWhere } = view(scope);
  const [invoices, adjustments] = await Promise.all([
    prisma.outboundInvoice.findMany({
      where: { ...invoiceWhere, serial_number: { not: null } },
      select: { serial_number: true },
    }),
    prisma.outboundAdjustment.findMany({
      where: { ...adjustmentWhere, serial_number: { not: null } },
      select: { serial_number: true },
    }),
  ]);
  return buildGapsFromSerials([
    ...invoices.map((row) => row.serial_number),
    ...adjustments.map((row) => row.serial_number),
  ]);
});

async function loadAuditEvents(scope: Scope, take: number): Promise<AuditEvent[]> {
  const { invoiceWhere, adjustmentWhere } = view(scope);
  const range = monthRange(scope.appliedFilters.period);
  const records = await prisma.auditLog.findMany({
    where: {
      organization_id: scope.organizationId,
      ...(scope.appliedFilters.entityId !== "all" ? { legal_entity_id: { in: scope.entityIds } } : {}),
      ...(range ? { created_at: range } : {}),
    },
    orderBy: { created_at: "desc" },
    take,
    select: {
      id: true,
      created_at: true,
      event: true,
      outbound_invoice_id: true,
      outbound_adjustment_id: true,
      inbound_invoice_id: true,
    },
  });
  const invoiceIds = records.flatMap((row) => (row.outbound_invoice_id ? [row.outbound_invoice_id] : []));
  const adjustmentIds = records.flatMap((row) => (row.outbound_adjustment_id ? [row.outbound_adjustment_id] : []));
  const [invoices, adjustments] = await Promise.all([
    invoiceIds.length === 0
      ? []
      : prisma.outboundInvoice.findMany({
          where: { AND: [invoiceWhere, { id: { in: invoiceIds } }] },
          select: { id: true, serial_number: true },
        }),
    adjustmentIds.length === 0
      ? []
      : prisma.outboundAdjustment.findMany({
          where: { AND: [adjustmentWhere, { id: { in: adjustmentIds } }] },
          select: { id: true, serial_number: true },
        }),
  ]);
  const serialByInvoice = new Map(invoices.map((row) => [String(row.id), row.serial_number ?? "—"]));
  const serialByAdjustment = new Map(adjustments.map((row) => [String(row.id), row.serial_number ?? "—"]));
  return records.map((row) => ({
    id: String(row.id),
    at: formatStamp(row.created_at.toISOString()),
    event: row.event.replace(/[._]/g, " "),
    document: row.outbound_invoice_id
      ? (serialByInvoice.get(String(row.outbound_invoice_id)) ?? `Invoice ${row.outbound_invoice_id}`)
      : row.outbound_adjustment_id
        ? (serialByAdjustment.get(String(row.outbound_adjustment_id)) ?? `Adjustment ${row.outbound_adjustment_id}`)
        : row.inbound_invoice_id
          ? `Purchase ${row.inbound_invoice_id}`
          : "Organization",
  }));
}

const connectionSelect = {
  id: true,
  legal_entity_id: true,
  erp_code: true,
  label: true,
  connected_at: true,
  ingestion_mode: true,
  status: true,
  endpoint_url: true,
  last_invoice_id: true,
  last_error: true,
} satisfies Prisma.ErpConnectionSelect;

function maskApiKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const tail = value.length >= 8 ? value.slice(-4) : "";
  return `••••••••${tail}`;
}

function connectionView(
  row: {
    id: bigint;
    erp_code: string;
    label: string | null;
    legal_entity_id: bigint | null;
    endpoint_url: string | null;
    api_secret?: string | null;
    connected_at: Date;
    ingestion_mode: string;
    status: string;
    last_invoice_id: string | null;
    last_error: string | null;
  },
  entityName: Map<number, string>,
  pendingRequest: "enable" | "disable" | null,
): ErpConnectionView {
  return {
    id: String(row.id),
    code: row.erp_code,
    name: erpName(row.erp_code),
    label: row.label,
    entityId: row.legal_entity_id === null ? null : String(row.legal_entity_id),
    entityName: row.legal_entity_id === null ? null : (entityName.get(Number(row.legal_entity_id)) ?? null),
    endpointUrl: row.endpoint_url,
    maskedApiKey: maskApiKey(row.api_secret),
    connectedAt: row.connected_at.toISOString(),
    ingestionMode: row.ingestion_mode,
    status: row.status,
    lastInvoiceId: row.last_invoice_id,
    lastError: row.last_error,
    pendingRequest,
  };
}

export const loadSubscription = cache(async () => {
  const access = await resolveAccess();
  const record = await prisma.invoiceUsage.findFirst({
    where: { organization_id: BigInt(access.organization.id) },
    orderBy: { period: "desc" },
  });
  const usage = record ? invoiceUsageRow(record) : null;
  return {
    organization: {
      name: access.organization.name,
      monthlyAllowance: access.organization.monthly_allowance,
    },
    usage: {
      clearedCount: usage?.cleared_count ?? 0,
      monthLabel: usage ? monthTitle(usage.period) : monthTitle(new Date().toISOString()),
    },
  };
});

export const loadUsers = cache(async () => {
  const access = await resolveAccess();
  const organizationId = BigInt(access.organization.id);
  const memberships = (
    await prisma.membership.findMany({ where: { organization_id: organizationId } })
  ).map(membershipRow);
  const auth = supabase();
  const accounts = new Map(
    await Promise.all(
      memberships.map(async (membership) => {
        const result = await auth.auth.admin.getUserById(membership.user_id);
        if (result.error || !result.data.user) {
          const missing = result.error?.status === 404 || result.error?.code === "user_not_found";
          if (!missing) throw new Error(`auth user: ${result.error?.message ?? "missing"}`);
          return [membership.user_id, null] as const;
        }
        return [membership.user_id, result.data.user] as const;
      }),
    ),
  );
  const users = memberships
    .map((membership) => {
      const account = accounts.get(membership.user_id);
      const email = account?.email ?? "";
      const metadataName = account?.user_metadata?.name;
      const name = typeof metadataName === "string" && metadataName ? metadataName : email.split("@")[0];
      return { name, email, role: asRole(membership.role) };
    })
    .sort((left, right) => portalRoles.indexOf(left.role) - portalRoles.indexOf(right.role));
  return {
    users,
    organization: { id: String(access.organization.id) },
    canInvite: permissions(access.role).canInvite,
  };
});

export const loadSetup = cache(async () => {
  const scope = await loadScope();
  const [records, requests, entities] = await Promise.all([
    prisma.erpConnection.findMany({
      where: { organization_id: scope.organizationId },
      orderBy: [{ connected_at: "asc" }],
      select: { ...connectionSelect, api_secret: true },
    }),
    prisma.erpChangeRequest.findMany({
      where: { organization_id: scope.organizationId, status: "pending" },
      select: { erp_connection_id: true, action: true },
    }),
    prisma.legalEntity.findMany({
      where: { organization_id: scope.organizationId },
      orderBy: { name: "asc" },
      include: { branches: { orderBy: { code: "asc" } } },
    }),
  ]);
  const pending = new Map(
    requests.flatMap((row) =>
      row.action === "enable" || row.action === "disable" ? [[String(row.erp_connection_id), row.action] as const] : [],
    ),
  );
  const counters =
    entities.length === 0
      ? []
      : (
          await prisma.serialCounter.findMany({
            where: { legal_entity_id: { in: entities.map((entity) => entity.id) } },
          })
        ).map(serialCounterRow);
  const preferredGazette = gazettePeriod(scope.appliedFilters.period);
  const legalEntities = entities.map((entity) => ({
    id: String(entity.id),
    name: entity.name,
    tin: entity.tin,
    vatNumber: entity.vat_number,
    ramisEnabled: entity.ramis_enabled,
  }));
  const branches: BranchView[] = entities.flatMap((entity) =>
    entity.branches.map((branch) => {
      const branchId = Number(branch.id);
      const counter = counters
        .filter((item) => item.branch_id === branchId)
        .sort((left, right) => {
          if (preferredGazette && left.period === preferredGazette) return -1;
          if (preferredGazette && right.period === preferredGazette) return 1;
          return periodRank(right.period) - periodRank(left.period);
        })[0];
      return {
        id: branchKey(Number(entity.id), branch.code),
        code: branch.code,
        name: branch.name,
        entityId: String(entity.id),
        entity: entity.name,
        nextSerial: counter ? formatGazetteSerial(counter.period, branch.code, counter.last_value + 1) : "—",
      };
    }),
  );
  return {
    erpCatalog: erpCatalog.map((erp) => ({ code: erp.code, name: erp.name })),
    erpConnections: records.map((row) => connectionView(row, new Map(), pending.get(String(row.id)) ?? null)),
    legalEntities,
    branches,
    organization: organizationOf(scope),
    pollingEnabled: scope.access.organization.polling_enabled,
    canMap: scope.flags.canMap,
  };
});

export const loadExceptions = cache(async () => {
  const scope = await loadScope();
  const { invoiceWhere, adjustmentWhere } = view(scope);
  const [invoices, adjustments] = await Promise.all([
    invoiceSources({ ...invoiceWhere, ramis_status: "rejected" }),
    adjustmentSources({ ...adjustmentWhere, ramis_status: "rejected" }),
  ]);
  const documents = buildDocuments({ invoices, adjustments, ...lookupNames(scope) });
  await flagDuplicateSerials(documents, invoiceWhere, adjustmentWhere);
  return {
    rejected: present(documents),
    organization: organizationOf(scope),
    canRequeue: scope.flags.canRequeue,
  };
});

export const loadScheduleDocuments = cache(async (schedule: "01" | "04" | "07") => {
  const scope = await loadScope();
  const { invoiceWhere, adjustmentWhere } = view(scope);
  const documents =
    schedule === "04"
      ? buildDocuments({
          invoices: [],
          adjustments: await adjustmentSources(adjustmentWhere),
          ...lookupNames(scope),
        })
      : buildDocuments({
          invoices: await invoiceSources({
            ...invoiceWhere,
            invoice_type: schedule === "07" ? "zero_rated" : { not: "zero_rated" },
          }),
          adjustments: [],
          ...lookupNames(scope),
        });
  return { invoices: present(documents) };
});

export const loadSchedulePurchases = cache(async () => {
  const scope = await loadScope();
  const { purchaseWhere } = view(scope);
  return {
    scheduleRows: await purchaseRows(purchaseWhere, lookupNames(scope).entityName),
    organization: organizationOf(scope),
    canApprove: scope.flags.canApprove,
  };
});

export const loadAudit = cache(async () => {
  const scope = await loadScope();
  if (!scope.flags.canAudit) return { canAudit: false as const };
  const [gaps, auditEvents] = await Promise.all([loadGapRows(), loadAuditEvents(scope, 50)]);
  return { canAudit: true as const, query: scope.query, gaps, auditEvents };
});

export const loadStatement = cache(async () => {
  const scope = await loadScope();
  if (!scope.flags.canAudit) return { canAudit: false as const };
  return {
    canAudit: true as const,
    organization: organizationOf(scope),
    filters: scope.appliedFilters,
    gaps: await loadGapRows(),
  };
});

export const loadIngestion = cache(async () => {
  const scope = await loadScope();
  const { invoiceWhere, adjustmentWhere } = view(scope);
  const [pipeline, auditEvents] = await Promise.all([
    statusPipeline(invoiceWhere, adjustmentWhere),
    scope.flags.canAudit ? loadAuditEvents(scope, 8) : Promise.resolve([]),
  ]);
  return { pipeline, canAudit: scope.flags.canAudit, auditEvents };
});

export const loadOverview = cache(async () => {
  const scope = await loadScope();
  const { invoiceWhere, adjustmentWhere, purchaseWhere } = view(scope);
  const clearedSalesWhere: Prisma.OutboundInvoiceWhereInput = {
    ...invoiceWhere,
    ramis_status: "cleared",
    invoice_type: { not: "zero_rated" },
  };
  const chartMonth =
    scope.appliedFilters.period !== "all"
      ? scope.appliedFilters.period
      : await findLatestMonth(invoiceWhere, adjustmentWhere);
  const chartRange = monthRange(chartMonth);
  const [
    salesSums,
    salesByClass,
    salesByDay,
    creditSums,
    debitSums,
    pipeline,
    inboundGroups,
    statusGroups,
    unapprovedGroups,
    recentInvoices,
    recentAdjustments,
  ] = await Promise.all([
    prisma.outboundInvoice.aggregate({
      where: clearedSalesWhere,
      _sum: { vat_amount: true, total_amount: true },
    }),
    prisma.outboundInvoice.groupBy({
      by: ["invoice_type"],
      where: clearedSalesWhere,
      _sum: { amount_exclusive_vat: true },
    }),
    chartRange
      ? prisma.outboundInvoice.groupBy({
          by: ["invoice_date"],
          where: { ...clearedSalesWhere, invoice_date: chartRange },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    prisma.outboundAdjustment.aggregate({
      where: { ...adjustmentWhere, ramis_status: "cleared", adjustment_type: "credit_note" },
      _sum: { adjusted_vat_amount: true, adjusted_total_amount: true },
    }),
    prisma.outboundAdjustment.aggregate({
      where: { ...adjustmentWhere, ramis_status: "cleared", adjustment_type: "debit_note" },
      _sum: { adjusted_vat_amount: true, adjusted_total_amount: true },
    }),
    statusPipeline(invoiceWhere, adjustmentWhere),
    prisma.inboundInvoice.groupBy({
      by: ["is_approved_for_input_vat"],
      where: purchaseWhere,
      _sum: { vat_amount: true },
    }),
    prisma.outboundInvoice.groupBy({
      by: ["legal_entity_id", "ramis_status"],
      where: { organization_id: scope.organizationId },
      _count: { _all: true },
    }),
    prisma.inboundInvoice.groupBy({
      by: ["legal_entity_id"],
      where: { organization_id: scope.organizationId, is_approved_for_input_vat: false },
      _count: { _all: true },
    }),
    invoiceSources(invoiceWhere, 4),
    adjustmentSources(adjustmentWhere, 4),
  ]);

  let approvedInputVat = 0;
  let unapprovedInputVat = 0;
  for (const row of inboundGroups) {
    const vat = amount(row._sum.vat_amount);
    if (row.is_approved_for_input_vat) approvedInputVat += vat;
    else unapprovedInputVat += vat;
  }
  const total = pipeline.cleared + pipeline.submitting + pipeline.rejected + pipeline.skipped;
  const metrics = aggregateMetrics({
    period: scope.appliedFilters.period,
    latestMonth: chartMonth,
    salesVat: amount(salesSums._sum.vat_amount),
    salesTotal: amount(salesSums._sum.total_amount),
    salesNetByClass: [...salesByClass]
      .sort((left, right) => classOrder.indexOf(left.invoice_type) - classOrder.indexOf(right.invoice_type))
      .map((row) => ({
        invoiceClass: row.invoice_type,
        net: amount(row._sum.amount_exclusive_vat),
      })),
    clearedSalesByDay: salesByDay.map((row) => ({ day: day(row.invoice_date), count: row._count._all })),
    creditVat: amount(creditSums._sum.adjusted_vat_amount),
    creditTotal: amount(creditSums._sum.adjusted_total_amount),
    debitVat: amount(debitSums._sum.adjusted_vat_amount),
    approvedInputVat,
    unapprovedInputVat,
    cleared: pipeline.cleared,
    submitting: pipeline.submitting,
    rejected: pipeline.rejected,
    skipped: pipeline.skipped,
    total,
  });

  const unapproved = new Map(unapprovedGroups.map((row) => [Number(row.legal_entity_id), row._count._all]));
  const healthBuckets = new Map<number, { cleared: number; skipped: number; rejected: number; total: number }>();
  for (const row of statusGroups) {
    const id = Number(row.legal_entity_id);
    const bucket = healthBuckets.get(id) ?? { cleared: 0, skipped: 0, rejected: 0, total: 0 };
    const count = row._count._all;
    bucket.total += count;
    if (row.ramis_status === "cleared") bucket.cleared += count;
    if (row.ramis_status === "skipped_non_vat") bucket.skipped += count;
    if (row.ramis_status === "rejected") bucket.rejected += count;
    healthBuckets.set(id, bucket);
  }
  const recent = present(
    buildDocuments({
      invoices: recentInvoices,
      adjustments: recentAdjustments,
      ...lookupNames(scope),
    }),
  ).slice(0, 4);

  return {
    organization: organizationOf(scope),
    query: scope.query,
    metrics,
    pipeline,
    recent,
    health: scope.entities.map((entity) => {
      const bucket = healthBuckets.get(entity.id) ?? { cleared: 0, skipped: 0, rejected: 0, total: 0 };
      const considered = bucket.total - bucket.skipped;
      return {
        id: String(entity.id),
        name: entity.name,
        tin: entity.tin,
        rejected: bucket.rejected,
        unapprovedInput: unapproved.get(entity.id) ?? 0,
        clearanceRate: considered <= 0 ? "—" : `${((bucket.cleared / considered) * 100).toFixed(1)}%`,
        selected: scope.appliedFilters.entityId === "all" || scope.appliedFilters.entityId === String(entity.id),
      };
    }),
  };
});

export const loadInvoice = cache(async (id: string) => {
  const scope = await loadScope();
  const parsed = documentKey(id);
  const base = { organization: organizationOf(scope), canRequeue: scope.flags.canRequeue };
  if (!parsed) return { ...base, invoice: null };

  const { invoiceWhere, adjustmentWhere } = view(scope);
  const documents =
    parsed.kind === "invoice"
      ? buildDocuments({
          invoices: await invoiceSources({ ...invoiceWhere, id: parsed.id }),
          adjustments: [],
          ...lookupNames(scope),
        })
      : buildDocuments({
          invoices: [],
          adjustments: await adjustmentSources({ ...adjustmentWhere, id: parsed.id }),
          ...lookupNames(scope),
        });
  await flagDuplicateSerials(documents, invoiceWhere, adjustmentWhere);
  return { ...base, invoice: present(documents)[0] ?? null };
});

export const loadReturnPack = cache(async () => {
  const scope = await loadScope();
  const { invoiceWhere, adjustmentWhere, purchaseWhere } = view(scope);
  const names = lookupNames(scope);
  const [invoices, adjustments, scheduleRows] = await Promise.all([
    invoiceSources(invoiceWhere),
    adjustmentSources(adjustmentWhere),
    purchaseRows(purchaseWhere, names.entityName),
  ]);
  return {
    invoices: present(buildDocuments({ invoices, adjustments, ...names })),
    scheduleRows,
  };
});
