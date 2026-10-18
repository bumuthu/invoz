import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import {
  formatGazetteSerial,
  portalRoleLabel,
  portalRoles,
  type PortalRole,
  type BranchRow,
  type FieldMappingRow,
  type InboundInvoiceRow,
  type InvoiceUsageRow,
  type LegalEntityRow,
  type MembershipRow,
  type OrganizationRow,
  type OutboundAdjustmentRow,
  type OutboundInvoiceRow,
  type SerialCounterRow,
} from "@ramis/common";
import { supabase } from "@/lib/supabase";
import type { Invoice, InvoiceStatus, PortalData } from "@/lib/types";

const shortMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const gazetteMonths = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const fullMonths = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const statusLabel: Record<string, InvoiceStatus> = {
  cleared: "Cleared",
  rejected: "Rejected",
  queued: "Submitting",
  validated: "Submitting",
  draft: "Submitting",
  skipped_non_vat: "Skipped",
};

const fieldOrder = [
  "Buyer TIN",
  "Buyer name",
  "Invoice date",
  "Supply date",
  "Branch code",
  "Net amount",
  "VAT amount",
  "Ignore",
];

function rows<T>(data: T[] | null, error: { message: string } | null, table: string): T[] {
  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }
  return data ?? [];
}

function money(value: string | number): string {
  return `LKR ${Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return `${day} ${shortMonths[month - 1]} ${year}`;
}

function monthLabel(period: string): string {
  const [year, month] = period.slice(0, 10).split("-").map(Number);
  return `${fullMonths[month - 1]} ${year}`;
}

function labelStatus(status: string): InvoiceStatus {
  const label = statusLabel[status];
  if (!label) {
    throw new Error(`ramis status ${status} has no portal label`);
  }
  return label;
}

function asRole(role: string): PortalRole {
  if (!(portalRoles as readonly string[]).includes(role)) {
    throw new Error(`membership role ${role} is not a portal role`);
  }
  return role as PortalRole;
}

function periodRank(period: string): number {
  return Number(period.slice(0, 2)) * 12 + gazetteMonths.indexOf(period.slice(2));
}

async function requestedSlug(): Promise<string | null> {
  const host = (await headers()).get("host")?.split(":")[0] ?? "";
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  if (!root || host === "localhost" || host.endsWith(".localhost")) {
    return null;
  }
  const suffix = `.${root}`;
  if (!host.endsWith(suffix) || host === root) {
    return null;
  }
  return host.slice(0, -suffix.length);
}

export const loadPortal = cache(async (): Promise<PortalData> => {
  const db = supabase();
  const slug = await requestedSlug();
  const organizationResult = await db.from("organizations").select("*");
  const organizations = rows<OrganizationRow>(
    organizationResult.data as OrganizationRow[] | null,
    organizationResult.error,
    "organizations",
  ).filter((item) => (slug ? item.slug === slug : true));
  const organization = organizations[0];
  if (!organization) {
    throw new Error(slug ? `No organization matches ${slug}` : "No organization is in the database");
  }

  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost";
  const [entityResult, membershipResult, usageResult, accountResult] = await Promise.all([
    db.from("legal_entities").select("*").eq("organization_id", organization.id),
    db.from("memberships").select("*").eq("organization_id", organization.id),
    db.from("invoice_usage").select("*").eq("organization_id", organization.id),
    db.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const entities = rows<LegalEntityRow>(
    entityResult.data as LegalEntityRow[] | null,
    entityResult.error,
    "legal_entities",
  );
  const entity = entities[0];
  if (!entity) {
    throw new Error(`${organization.name} has no legal entity`);
  }
  const memberships = rows<MembershipRow>(
    membershipResult.data as MembershipRow[] | null,
    membershipResult.error,
    "memberships",
  );
  const usageRows = rows<InvoiceUsageRow>(
    usageResult.data as InvoiceUsageRow[] | null,
    usageResult.error,
    "invoice_usage",
  );
  if (accountResult.error) {
    throw new Error(`auth users: ${accountResult.error.message}`);
  }

  const [branchResult, counterResult, mappingResult, invoiceResult, adjustmentResult, inboundResult] =
    await Promise.all([
      db.from("branches").select("*").eq("legal_entity_id", entity.id),
      db.from("serial_counters").select("*").eq("legal_entity_id", entity.id),
      db.from("field_mappings").select("*").eq("legal_entity_id", entity.id),
      db.from("outbound_invoices").select("*").eq("legal_entity_id", entity.id),
      db.from("outbound_adjustments").select("*").eq("legal_entity_id", entity.id),
      db.from("inbound_invoices").select("*").eq("legal_entity_id", entity.id),
    ]);

  const branchRows = rows<BranchRow>(branchResult.data as BranchRow[] | null, branchResult.error, "branches");
  const counters = rows<SerialCounterRow>(
    counterResult.data as SerialCounterRow[] | null,
    counterResult.error,
    "serial_counters",
  );
  const mappings = rows<FieldMappingRow>(
    mappingResult.data as FieldMappingRow[] | null,
    mappingResult.error,
    "field_mappings",
  );
  const invoiceRows = rows<OutboundInvoiceRow>(
    invoiceResult.data as OutboundInvoiceRow[] | null,
    invoiceResult.error,
    "outbound_invoices",
  );
  const adjustmentRows = rows<OutboundAdjustmentRow>(
    adjustmentResult.data as OutboundAdjustmentRow[] | null,
    adjustmentResult.error,
    "outbound_adjustments",
  );
  const inboundRows = rows<InboundInvoiceRow>(
    inboundResult.data as InboundInvoiceRow[] | null,
    inboundResult.error,
    "inbound_invoices",
  );

  const accounts = new Map(accountResult.data.users.map((user) => [user.id, user]));
  const branchCode = new Map(branchRows.map((branch) => [branch.id, branch.code]));
  const invoiceById = new Map(invoiceRows.map((invoice) => [invoice.id, invoice]));

  const users = memberships
    .map((membership) => {
      const account = accounts.get(membership.user_id);
      const email = account?.email ?? "";
      const metadataName = account?.user_metadata?.name;
      const name = typeof metadataName === "string" && metadataName ? metadataName : email.split("@")[0];
      return { name, email, role: asRole(membership.role) };
    })
    .sort((left, right) => portalRoles.indexOf(left.role) - portalRoles.indexOf(right.role));

  const owner = users.find((user) => user.role === "owner") ?? users[0];
  const usage = [...usageRows].sort((left, right) => (left.period < right.period ? 1 : -1))[0];

  const invoices: Invoice[] = [
    ...invoiceRows.map((row) => ({
      at: row.created_at,
      invoice: {
        id: row.id,
        serial: row.serial_number ?? "—",
        buyer: row.customer_name,
        buyerTin: row.customer_tin,
        invoiceDate: formatDate(row.invoice_date),
        supplyDate: formatDate(row.supply_date),
        amount: money(row.amount_exclusive_vat),
        vat: money(row.vat_amount),
        status: labelStatus(row.ramis_status),
        branch: branchCode.get(row.branch_id) ?? row.branch_id,
        entity: entity.name,
        kind: "Tax invoice" as const,
        note: row.error_message ?? undefined,
      },
    })),
    ...adjustmentRows.map((row) => {
      const original = invoiceById.get(row.original_invoice_id);
      return {
        at: row.created_at,
        invoice: {
          id: row.id,
          serial: row.serial_number ?? "—",
          buyer: original?.customer_name ?? row.reason,
          buyerTin: original?.customer_tin ?? "",
          invoiceDate: formatDate(row.adjustment_date),
          supplyDate: formatDate(row.adjustment_date),
          amount: money(row.adjusted_amount_exclusive_vat),
          vat: money(row.adjusted_vat_amount),
          status: labelStatus(row.ramis_status),
          branch: branchCode.get(row.branch_id) ?? row.branch_id,
          entity: entity.name,
          kind: "Credit note" as const,
          note: row.error_message ?? undefined,
        },
      };
    }),
  ]
    .sort((left, right) => (left.at < right.at ? 1 : -1))
    .map((item) => item.invoice);

  const fieldMappings = mappings.map((row) => ({
    source: row.source_column,
    target: row.target_field,
  }));
  const mappedTargets = new Set(fieldMappings.map((row) => row.target));

  return {
    organization: {
      name: organization.name,
      slug: organization.slug,
      host: `${organization.slug}.${root}`,
      entity: entity.name,
      tin: entity.tin,
      monthlyAllowance: organization.monthly_allowance,
    },
    currentUser: {
      name: owner?.name ?? "Owner",
      email: owner?.email ?? "",
      role: owner ? portalRoleLabel(owner.role) : "Owner",
    },
    users,
    usage: {
      clearedCount: usage?.cleared_count ?? 0,
      monthLabel: usage ? monthLabel(usage.period) : monthLabel(new Date().toISOString()),
    },
    branches: branchRows.map((branch) => {
      const counter = counters
        .filter((item) => item.branch_id === branch.id)
        .sort((left, right) => periodRank(right.period) - periodRank(left.period))[0];
      return {
        code: branch.code,
        name: branch.name,
        nextSerial: counter
          ? formatGazetteSerial(counter.period, branch.code, counter.last_value + 1)
          : "—",
      };
    }),
    fieldMappings,
    targetFields: [
      ...fieldOrder.filter((field) => mappedTargets.has(field)),
      ...fieldMappings.map((row) => row.target).filter((field) => !fieldOrder.includes(field)),
    ],
    invoices,
    scheduleRows: inboundRows.map((row) => ({
      id: row.id,
      supplier: row.supplier_name,
      tin: row.supplier_tin,
      serial: row.supplier_invoice_number,
      amount: money(row.amount_exclusive_vat),
      vat: money(row.vat_amount),
      matched: row.erp_voucher_reference ?? "Unmatched",
    })),
  };
});
