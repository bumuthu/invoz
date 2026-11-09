import "server-only";
import type { Prisma } from "@invoz/database";
import { portalRoleLabel, type PortalRole } from "@invoz/common";
import { prisma } from "@invoz/database";
import { requireAdmin } from "@/lib/access";
import { addCount, emptyCounts, monthBounds } from "@/lib/counts";
import { supabase } from "@/lib/supabase";
import type {
  ConnectionRow,
  LeadView,
  LegalEntityView,
  OrganizationDetail,
  OrganizationSummary,
  Overview,
  Range,
  RequestView,
  StatusCounts,
} from "@/lib/types";

type Group = { organization_id: bigint; legal_entity_id: bigint; ramis_status: string; _count: { _all: number } };

export async function loadOverview(range: Range): Promise<Overview> {
  await requireAdmin();
  const [organizations, groups, usage] = await Promise.all([
    prisma.organization.findMany({ orderBy: { name: "asc" } }),
    statusGroups(range),
    monthUsage(),
  ]);
  const byOrg = new Map<string, StatusCounts>();
  const totals = emptyCounts();
  for (const group of groups) {
    const key = String(group.organization_id);
    const counts = byOrg.get(key) ?? emptyCounts();
    addCount(counts, group.ramis_status, group._count._all);
    addCount(totals, group.ramis_status, group._count._all);
    byOrg.set(key, counts);
  }
  return {
    range,
    totals,
    organizations: organizations.map((organization) =>
      summary(organization, byOrg.get(String(organization.id)) ?? emptyCounts(), usage.get(String(organization.id)) ?? 0),
    ),
  };
}

export async function loadOrganizations(): Promise<OrganizationSummary[]> {
  const overview = await loadOverview("all");
  return overview.organizations;
}

export async function loadOrganization(id: string, range: Range): Promise<OrganizationDetail | null> {
  await requireAdmin();
  if (!/^\d+$/.test(id)) return null;
  const organizationId = BigInt(id);
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      legalEntities: {
        orderBy: { name: "asc" },
        include: {
          branches: { orderBy: { code: "asc" } },
          ramisCredential: { select: { legal_entity_id: true } },
        },
      },
      memberships: { orderBy: { created_at: "asc" } },
      erpConnections: { orderBy: { id: "asc" } },
      sftpCredential: { select: { organization_id: true } },
    },
  });
  if (!organization) return null;

  const [groups, usageRows] = await Promise.all([
    statusGroups(range, organizationId),
    prisma.invoiceUsage.findMany({ where: { organization_id: organizationId, period: periodWhere() } }),
  ]);
  const byEntity = new Map<string, StatusCounts>();
  const orgCounts = emptyCounts();
  for (const group of groups) {
    const key = String(group.legal_entity_id);
    const counts = byEntity.get(key) ?? emptyCounts();
    addCount(counts, group.ramis_status, group._count._all);
    addCount(orgCounts, group.ramis_status, group._count._all);
    byEntity.set(key, counts);
  }
  const used = usageRows.reduce((sum, row) => sum + row.cleared_count, 0);
  const entities: LegalEntityView[] = organization.legalEntities.map((entity) => ({
    id: String(entity.id),
    name: entity.name,
    tin: entity.tin,
    vatNumber: entity.vat_number,
    ramisEnabled: entity.ramis_enabled,
    certificateOnFile: entity.ramisCredential !== null,
    counts: byEntity.get(String(entity.id)) ?? emptyCounts(),
    branches: entity.branches.map((branch) => ({ id: String(branch.id), code: branch.code, name: branch.name })),
  }));
  const auth = supabase();
  const members = await Promise.all(
    organization.memberships.map(async (membership) => {
      const result = await auth.auth.admin.getUserById(membership.user_id);
      const user = result.data.user;
      const metadata = user?.user_metadata as { name?: string } | undefined;
      return {
        id: String(membership.id),
        email: user?.email ?? membership.user_id,
        name: metadata?.name?.trim() || "Member",
        role: portalRoleLabel(membership.role as PortalRole),
      };
    }),
  );
  return {
    ...summary(organization, orgCounts, used),
    pollingEnabled: organization.polling_enabled,
    hasSftpPassword: organization.sftpCredential !== null,
    entities,
    members,
    connections: connectionRows(organization),
  };
}

export async function loadConnections(): Promise<ConnectionRow[]> {
  await requireAdmin();
  const organizations = await prisma.organization.findMany({
    orderBy: { name: "asc" },
    include: {
      legalEntities: {
        orderBy: { name: "asc" },
        include: { ramisCredential: { select: { legal_entity_id: true } } },
      },
      erpConnections: { orderBy: { id: "asc" } },
    },
  });
  return organizations.flatMap((organization) => connectionRows(organization));
}

export async function loadRequests(): Promise<{ sftp: RequestView[]; poll: RequestView[] }> {
  await requireAdmin();
  const requests = await prisma.erpChangeRequest.findMany({
    where: { status: "pending" },
    include: {
      organization: { select: { id: true, name: true, slug: true, sftpCredential: { select: { organization_id: true } } } },
      connection: {
        select: { erp_code: true, label: true, ingestion_mode: true, endpoint_url: true, status: true },
      },
    },
    orderBy: { created_at: "asc" },
  });
  const auth = supabase();
  const emails = new Map<string, string>();
  await Promise.all(
    [...new Set(requests.map((request) => request.user_id))].map(async (userId) => {
      const result = await auth.auth.admin.getUserById(userId);
      emails.set(userId, result.data.user?.email ?? userId);
    }),
  );
  const views = requests.map((request): RequestView => ({
    id: String(request.id),
    organizationId: String(request.organization.id),
    organization: request.organization.name,
    slug: request.organization.slug,
    mode: request.connection.ingestion_mode,
    erp: request.connection.erp_code,
    label: request.connection.label,
    endpoint: request.connection.ingestion_mode === "poll" ? request.connection.endpoint_url : null,
    connectionStatus: request.connection.status,
    action: request.action,
    requester: emails.get(request.user_id) ?? request.user_id,
    createdAt: request.created_at.toISOString(),
    hasSftpPassword: request.organization.sftpCredential !== null,
  }));
  return {
    sftp: views.filter((request) => request.mode === "sftp"),
    poll: views.filter((request) => request.mode === "poll"),
  };
}

export async function loadLeads(): Promise<LeadView[]> {
  await requireAdmin();
  const leads = await prisma.demoRequest.findMany({ orderBy: { created_at: "desc" }, take: 200 });
  return leads.map((lead) => ({
    id: String(lead.id),
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    company: lead.company,
    erp: lead.erp,
    note: lead.note,
    createdAt: lead.created_at.toISOString(),
  }));
}

function summary(
  organization: { id: bigint; name: string; slug: string; monthly_allowance: number },
  counts: StatusCounts,
  used: number,
): OrganizationSummary {
  return {
    id: String(organization.id),
    name: organization.name,
    slug: organization.slug,
    allowance: organization.monthly_allowance,
    used,
    counts,
  };
}

function connectionRows(organization: {
  id: bigint;
  name: string;
  slug: string;
  legalEntities: Array<{
    id: bigint;
    name: string;
    tin: string;
    ramis_enabled: boolean;
    ramisCredential: { legal_entity_id: bigint } | null;
  }>;
  erpConnections: Array<{
    erp_code: string;
    label: string | null;
    status: string;
    ingestion_mode: string;
    endpoint_url: string | null;
    last_polled_at: Date | null;
    last_error: string | null;
  }>;
}): ConnectionRow[] {
  const connections = organization.erpConnections.length > 0 ? organization.erpConnections : [null];
  return organization.legalEntities.flatMap((entity) =>
    connections.map((connection) => ({
      organizationId: String(organization.id),
      organization: organization.name,
      slug: organization.slug,
      legalEntityId: String(entity.id),
      legalEntity: entity.name,
      tin: entity.tin,
      ramisEnabled: entity.ramis_enabled,
      certificateOnFile: entity.ramisCredential !== null,
      mode: connection?.ingestion_mode ?? null,
      erp: connection?.erp_code ?? null,
      label: connection?.label ?? null,
      status: connection?.status ?? null,
      endpoint: connection?.ingestion_mode === "poll" ? connection.endpoint_url : null,
      lastPolled: connection?.last_polled_at?.toISOString() ?? null,
      lastError: connection?.last_error ?? null,
    })),
  );
}

async function statusGroups(range: Range, organizationId?: bigint): Promise<Group[]> {
  const invoiceWhere: Prisma.OutboundInvoiceWhereInput = {};
  const adjustmentWhere: Prisma.OutboundAdjustmentWhereInput = {};
  if (organizationId !== undefined) {
    invoiceWhere.organization_id = organizationId;
    adjustmentWhere.organization_id = organizationId;
  }
  if (range === "month") {
    const { start, end } = monthBounds();
    invoiceWhere.invoice_date = { gte: start, lt: end };
    adjustmentWhere.adjustment_date = { gte: start, lt: end };
  }
  const [invoices, adjustments] = await Promise.all([
    prisma.outboundInvoice.groupBy({
      by: ["organization_id", "legal_entity_id", "ramis_status"],
      where: invoiceWhere,
      _count: { _all: true },
    }),
    prisma.outboundAdjustment.groupBy({
      by: ["organization_id", "legal_entity_id", "ramis_status"],
      where: adjustmentWhere,
      _count: { _all: true },
    }),
  ]);
  return [...invoices, ...adjustments];
}

async function monthUsage() {
  const rows = await prisma.invoiceUsage.findMany({ where: { period: periodWhere() } });
  const usage = new Map<string, number>();
  for (const row of rows) {
    const key = String(row.organization_id);
    usage.set(key, (usage.get(key) ?? 0) + row.cleared_count);
  }
  return usage;
}

function periodWhere() {
  const { start, end } = monthBounds();
  return { gte: start, lt: end };
}
