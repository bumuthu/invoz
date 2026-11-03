import "server-only";
import { prisma } from "@invoz/database";
import { resolveAccess } from "@/lib/access";
import { monthRange } from "@/lib/filters";

const statusLabel: Record<string, string> = {
  cleared: "Cleared",
  rejected: "Rejected",
  queued: "Submitting",
  validated: "Submitting",
  draft: "Submitting",
  skipped_non_vat: "Skipped",
};

const classLabel: Record<string, string> = {
  standard: "Standard",
  financial_services: "Financial services",
  zero_rated: "Zero-rated",
  exempt: "Exempt",
};

function cell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

function line(values: string[]): string {
  return values.map(cell).join(",");
}

function day(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function money(value: { toFixed(digits: number): string }, digits = 2): string {
  return value.toFixed(digits);
}

export async function scheduleCsv(schedule: "01" | "02" | "04" | "07"): Promise<string> {
  const access = await resolveAccess();
  const organizationId = BigInt(access.organization.id);
  const filters = access.filters;
  const entities = await prisma.legalEntity.findMany({
    where: {
      organization_id: organizationId,
      ...(filters.entityId === "all" ? {} : { id: BigInt(filters.entityId) }),
    },
    select: { id: true },
  });
  const entityIds = entities.map((entity) => entity.id);
  const range = monthRange(filters.period);
  let branchIds: bigint[] | null = null;
  if (filters.branch !== "all") {
    const [entityId, code] = filters.branch.split(":");
    const branches = await prisma.branch.findMany({
      where: {
        legal_entity_id: { in: entityIds },
        ...(entityId && code ? { legal_entity_id: BigInt(entityId), code } : {}),
      },
      select: { id: true },
    });
    branchIds = branches.map((branch) => branch.id);
  }

  if (schedule === "02") {
    const rows = await prisma.inboundInvoice.findMany({
      where: {
        organization_id: organizationId,
        legal_entity_id: { in: entityIds },
        ...(range ? { invoice_date: range } : {}),
      },
      include: { legalEntity: { select: { name: true } } },
      orderBy: { invoice_date: "asc" },
    });
    return [
      line([
        "Supplier name",
        "Supplier TIN",
        "Serial",
        "Invoice date",
        "Legal entity",
        "Net amount",
        "VAT amount",
        "Total",
        "ERP voucher",
        "Match",
        "Approval",
      ]),
      ...rows.map((row) =>
        line([
          row.supplier_name,
          row.supplier_tin,
          row.supplier_invoice_number,
          day(row.invoice_date),
          row.legalEntity.name,
          money(row.amount_exclusive_vat),
          money(row.vat_amount),
          money(row.total_amount),
          row.erp_voucher_reference ?? "",
          row.matching_status,
          row.is_approved_for_input_vat ? "Approved" : "Pending",
        ]),
      ),
    ].join("\n");
  }

  if (schedule === "04") {
    const rows = await prisma.outboundAdjustment.findMany({
      where: {
        organization_id: organizationId,
        legal_entity_id: { in: entityIds },
        ...(branchIds ? { branch_id: { in: branchIds } } : {}),
        ...(range ? { adjustment_date: range } : {}),
      },
      include: {
        legalEntity: { select: { name: true } },
        branch: { select: { code: true } },
        originalInvoice: { select: { customer_name: true, customer_tin: true } },
      },
      orderBy: { adjustment_date: "asc" },
    });
    return [
      line([
        "Serial",
        "Note type",
        "Note date",
        "Reason",
        "Original serial",
        "Original invoice date",
        "Buyer TIN",
        "Buyer name",
        "Branch code",
        "Legal entity",
        "Adjusted net",
        "Adjusted VAT",
        "Adjusted total",
        "Status",
        "Clearance token",
        "Error",
      ]),
      ...rows.map((row) =>
        line([
          row.serial_number ?? "",
          row.adjustment_type === "credit_note" ? "Credit note" : "Debit note",
          day(row.adjustment_date),
          row.reason,
          row.original_serial_number,
          day(row.original_invoice_date),
          row.customer_tin ?? row.originalInvoice.customer_tin,
          row.customer_name ?? row.originalInvoice.customer_name,
          row.branch.code,
          row.legalEntity.name,
          money(row.adjusted_amount_exclusive_vat),
          money(row.adjusted_vat_amount),
          money(row.adjusted_total_amount),
          statusLabel[row.ramis_status] ?? row.ramis_status,
          row.ramis_clearance_token ?? "",
          row.error_message ?? "",
        ]),
      ),
    ].join("\n");
  }

  const rows = await prisma.outboundInvoice.findMany({
    where: {
      organization_id: organizationId,
      legal_entity_id: { in: entityIds },
      invoice_type: schedule === "07" ? "zero_rated" : { not: "zero_rated" },
      ...(branchIds ? { branch_id: { in: branchIds } } : {}),
      ...(range ? { invoice_date: range } : {}),
    },
    include: { legalEntity: { select: { name: true } }, branch: { select: { code: true } } },
    orderBy: { invoice_date: "asc" },
  });
  return [
    line([
      "Serial",
      "ERP reference",
      "Invoice type",
      "Invoice date",
      "Supply date",
      "Buyer TIN",
      "Buyer name",
      "Branch code",
      "Legal entity",
      "Currency",
      "Exchange rate",
      "Net amount",
      "VAT rate",
      "VAT amount",
      "Total",
      "Status",
      "Clearance token",
      "Error",
    ]),
    ...rows.map((row) =>
      line([
        row.serial_number ?? "",
        row.erp_reference,
        classLabel[row.invoice_type] ?? row.invoice_type,
        day(row.invoice_date),
        day(row.supply_date),
        row.customer_tin,
        row.customer_name,
        row.branch.code,
        row.legalEntity.name,
        row.currency,
        money(row.exchange_rate, 4),
        money(row.amount_exclusive_vat),
        money(row.vat_rate),
        money(row.vat_amount),
        money(row.total_amount),
        statusLabel[row.ramis_status] ?? row.ramis_status,
        row.ramis_clearance_token ?? "",
        row.error_message ?? "",
      ]),
    ),
  ].join("\n");
}
