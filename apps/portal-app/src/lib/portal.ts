import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import {
  formatGazetteSerial,
  portalRoleLabel,
  portalRoles,
  type PortalRole,
} from "@invoz/common";
import {
  auditLogRow,
  branchRow,
  fieldMappingRow,
  inboundInvoiceRow,
  invoiceUsageRow,
  legalEntityRow,
  membershipRow,
  outboundAdjustmentRow,
  outboundInvoiceRow,
  prisma,
  serialCounterRow,
} from "@invoz/database";
import { permissions, resolveAccess } from "@/lib/access";
import {
  buildDocuments,
  buildGaps,
  buildMetrics,
  buildPipeline,
  formatDate,
  formatMoney,
  formatStamp,
  matchesOutbound,
  monthTitle,
  type ScopedDocument,
} from "@/lib/documents";
import { monthKey, monthRange, writeFilters } from "@/lib/filters";
import { targetFields } from "@/lib/fields";
import { supabase } from "@/lib/supabase";
import type { AuditEvent, BranchView, PortalData, ScheduleRow } from "@/lib/types";

const gazetteMonths = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

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

export const loadPortal = cache(async (): Promise<PortalData> => {
  const access = await resolveAccess();
  const filters = access.filters;
  const organizationId = BigInt(access.organization.id);
  const flags = permissions(access.role);
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  const requestHost = (await headers()).get("host")?.split(":")[0] ?? "";

  const [entityRecords, membershipRecords, usageRecords, accountResult] = await Promise.all([
    prisma.legalEntity.findMany({ where: { organization_id: organizationId }, orderBy: { name: "asc" } }),
    prisma.membership.findMany({ where: { organization_id: organizationId } }),
    prisma.invoiceUsage.findMany({ where: { organization_id: organizationId } }),
    supabase().auth.admin.listUsers({ perPage: 1000 }),
  ]);
  const entities = entityRecords.map(legalEntityRow);
  if (entities.length === 0) {
    throw new Error(`${access.organization.name} has no legal entity`);
  }
  if (accountResult.error) {
    throw new Error(`auth users: ${accountResult.error.message}`);
  }

  const selectedEntities =
    filters.entityId === "all" ? entities : entities.filter((entity) => String(entity.id) === filters.entityId);
  const scopedEntities = selectedEntities.length > 0 ? selectedEntities : entities;
  const appliedFilters =
    filters.entityId !== "all" && selectedEntities.length === 0 ? { ...filters, entityId: "all" } : filters;
  const entityIds = scopedEntities.map((entity) => BigInt(entity.id));
  const range = monthRange(appliedFilters.period);

  const [branchRecords, counterRecords, mappingRecords, invoiceDateRows, adjustmentDateRows, inboundDateRows] =
    await Promise.all([
      prisma.branch.findMany({ where: { legal_entity_id: { in: entityIds } }, orderBy: { name: "asc" } }),
      prisma.serialCounter.findMany({ where: { legal_entity_id: { in: entityIds } } }),
      prisma.fieldMapping.findMany({ where: { legal_entity_id: { in: entityIds } }, orderBy: { source_column: "asc" } }),
      prisma.outboundInvoice.findMany({
        where: { organization_id: organizationId, legal_entity_id: { in: entityIds } },
        select: { invoice_date: true },
        distinct: ["invoice_date"],
      }),
      prisma.outboundAdjustment.findMany({
        where: { organization_id: organizationId, legal_entity_id: { in: entityIds } },
        select: { adjustment_date: true },
        distinct: ["adjustment_date"],
      }),
      prisma.inboundInvoice.findMany({
        where: { organization_id: organizationId, legal_entity_id: { in: entityIds } },
        select: { invoice_date: true },
        distinct: ["invoice_date"],
      }),
    ]);

  const branches = branchRecords.map(branchRow);
  const counters = counterRecords.map(serialCounterRow);
  const mappings = mappingRecords.map(fieldMappingRow);
  const selectedBranch = branches.filter((branch) => branchKey(branch.legal_entity_id, branch.code) === appliedFilters.branch);
  const branchIds = appliedFilters.branch === "all" ? null : selectedBranch.map((branch) => BigInt(branch.id));
  const documentWhere = {
    organization_id: organizationId,
    legal_entity_id: { in: entityIds },
    ...(branchIds ? { branch_id: { in: branchIds } } : {}),
  };
  const purchaseWhere = {
    organization_id: organizationId,
    legal_entity_id: { in: entityIds },
    ...(range ? { invoice_date: range } : {}),
  };

  const [invoiceRecords, adjustmentRecords, inboundRecords, auditRecords, statusGroups, unapprovedGroups] =
    await Promise.all([
      prisma.outboundInvoice.findMany({
        where: { ...documentWhere, ...(range ? { invoice_date: range } : {}) },
      }),
      prisma.outboundAdjustment.findMany({
        where: { ...documentWhere, ...(range ? { adjustment_date: range } : {}) },
      }),
      prisma.inboundInvoice.findMany({ where: purchaseWhere }),
      prisma.auditLog.findMany({
        where: {
          organization_id: organizationId,
          ...(appliedFilters.entityId !== "all" ? { legal_entity_id: { in: entityIds } } : {}),
          ...(range ? { created_at: range } : {}),
        },
        orderBy: { created_at: "desc" },
        take: 50,
      }),
      prisma.outboundInvoice.groupBy({
        by: ["legal_entity_id", "ramis_status"],
        where: { organization_id: organizationId },
        _count: { _all: true },
      }),
      prisma.inboundInvoice.groupBy({
        by: ["legal_entity_id"],
        where: { organization_id: organizationId, is_approved_for_input_vat: false },
        _count: { _all: true },
      }),
    ]);

  const entityName = new Map(entities.map((entity) => [entity.id, entity.name]));
  const branchCode = new Map(branches.map((branch) => [branch.id, branch.code]));
  const branchName = new Map(branches.map((branch) => [branch.id, branch.name]));
  const scoped = buildDocuments({
    invoices: invoiceRecords.map(outboundInvoiceRow),
    adjustments: adjustmentRecords.map(outboundAdjustmentRow),
    branchCode,
    branchName,
    entityName,
  });
  const purchases = inboundRecords.map(inboundInvoiceRow).map((row) => ({
    id: String(row.id),
    supplier: row.supplier_name,
    tin: row.supplier_tin,
    serial: row.supplier_invoice_number,
    amount: formatMoney(row.amount_exclusive_vat),
    vat: formatMoney(row.vat_amount),
    voucher: row.erp_voucher_reference,
    match: row.matching_status,
    approved: row.is_approved_for_input_vat,
    invoiceDate: formatDate(row.invoice_date),
    entity: entityName.get(row.legal_entity_id) ?? String(row.legal_entity_id),
    vatValue: Number(row.vat_amount),
    month: monthKey(row.invoice_date),
  }));
  const visible = scoped.filter((document) => matchesOutbound(document, appliedFilters));
  const rejected = scoped.filter(
    (document) =>
      document.status === "Rejected" &&
      matchesOutbound(document, { ...appliedFilters, status: "all" }) &&
      (appliedFilters.status === "all" || appliedFilters.status === "Rejected"),
  );
  const scheduleRows: ScheduleRow[] =
    appliedFilters.schedule === "01" || appliedFilters.schedule === "04"
      ? []
      : purchases.map(({ vatValue: _vat, month: _month, ...row }) => row);

  const periods = [
    ...new Set(
      [
        ...invoiceDateRows.map((row) => row.invoice_date.toISOString().slice(0, 7)),
        ...adjustmentDateRows.map((row) => row.adjustment_date.toISOString().slice(0, 7)),
        ...inboundDateRows.map((row) => row.invoice_date.toISOString().slice(0, 7)),
      ].filter((period) => period !== ""),
    ),
  ].sort((left, right) => (left < right ? 1 : -1));

  const preferredGazette = gazettePeriod(appliedFilters.period);
  const branchViews: BranchView[] = branches.map((branch) => {
    const counter = counters
      .filter((item) => item.branch_id === branch.id)
      .sort((left, right) => {
        if (preferredGazette && left.period === preferredGazette) return -1;
        if (preferredGazette && right.period === preferredGazette) return 1;
        return periodRank(right.period) - periodRank(left.period);
      })[0];
    return {
      id: branchKey(branch.legal_entity_id, branch.code),
      code: branch.code,
      name: branch.name,
      entityId: String(branch.legal_entity_id),
      entity: entityName.get(branch.legal_entity_id) ?? String(branch.legal_entity_id),
      nextSerial: counter ? formatGazetteSerial(counter.period, branch.code, counter.last_value + 1) : "—",
    };
  });

  const serialByInvoice = new Map(
    scoped.filter((document) => document.source === "invoice").map((document) => [document.sourceId, document.serial]),
  );
  const serialByAdjustment = new Map(
    scoped
      .filter((document) => document.source === "adjustment")
      .map((document) => [document.sourceId, document.serial]),
  );
  const auditEvents: AuditEvent[] = auditRecords.map(auditLogRow).map((row) => ({
    id: String(row.id),
    at: formatStamp(row.created_at),
    event: row.event.replace(/[._]/g, " "),
    document: row.outbound_invoice_id
      ? (serialByInvoice.get(String(row.outbound_invoice_id)) ?? `Invoice ${row.outbound_invoice_id}`)
      : row.outbound_adjustment_id
        ? (serialByAdjustment.get(String(row.outbound_adjustment_id)) ?? `Adjustment ${row.outbound_adjustment_id}`)
        : row.inbound_invoice_id
          ? `Purchase ${row.inbound_invoice_id}`
          : "Organization",
  }));

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

  const accounts = new Map(accountResult.data.users.map((user) => [user.id, user]));
  const users = membershipRecords
    .map(membershipRow)
    .map((membership) => {
      const account = accounts.get(membership.user_id);
      const email = account?.email ?? "";
      const metadataName = account?.user_metadata?.name;
      const name = typeof metadataName === "string" && metadataName ? metadataName : email.split("@")[0];
      return { name, email, role: asRole(membership.role) };
    })
    .sort((left, right) => portalRoles.indexOf(left.role) - portalRoles.indexOf(right.role));
  const usageRows = usageRecords.map(invoiceUsageRow);
  const usage = [...usageRows].sort((left, right) => (left.period < right.period ? 1 : -1))[0];
  const showOrganization = !access.hostPinned && access.organizations.length > 1;

  return {
    organization: {
      id: String(access.organization.id),
      name: access.organization.name,
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
    ...flags,
    users,
    usage: {
      clearedCount: usage?.cleared_count ?? 0,
      monthLabel: usage ? monthTitle(usage.period) : monthTitle(new Date().toISOString()),
    },
    entities: entities.map((entity) => ({
      id: String(entity.id),
      name: entity.name,
      tin: entity.tin,
    })),
    branches: branchViews,
    periods,
    filters: appliedFilters,
    query: writeFilters(appliedFilters, String(access.organization.id), showOrganization),
    fieldMappings: mappings.map((row) => ({
      source: row.source_column,
      target: row.target_field,
      entityId: String(row.legal_entity_id),
    })),
    targetFields: [...targetFields],
    invoices: strip(visible),
    recent: strip(scoped.slice(0, 4)),
    rejected: strip(rejected),
    scheduleRows,
    gaps: buildGaps(scoped),
    auditEvents,
    health: entities.map((entity) => {
      const bucket = healthBuckets.get(entity.id) ?? { cleared: 0, skipped: 0, rejected: 0, total: 0 };
      const considered = bucket.total - bucket.skipped;
      return {
        id: String(entity.id),
        name: entity.name,
        tin: entity.tin,
        rejected: bucket.rejected,
        unapprovedInput: unapproved.get(entity.id) ?? 0,
        clearanceRate: considered <= 0 ? "—" : `${((bucket.cleared / considered) * 100).toFixed(1)}%`,
        selected: appliedFilters.entityId === "all" || appliedFilters.entityId === String(entity.id),
      };
    }),
    metrics: buildMetrics(scoped, purchases, appliedFilters.period),
    pipeline: buildPipeline(scoped),
  };
});

function strip(documents: ScopedDocument[]) {
  return documents.map(
    ({ invoiceClass: _class, netValue: _net, vatValue: _vat, totalValue: _total, cleared: _cleared, day: _day, month: _month, ...invoice }) =>
      invoice,
  );
}
