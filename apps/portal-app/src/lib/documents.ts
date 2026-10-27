import type { OutboundAdjustmentRow, OutboundInvoiceRow } from "@invoz/common";
import { monthKey, periodLabel } from "@/lib/filters";
import type {
  DailyPoint,
  GapRow,
  Invoice,
  InvoiceStatus,
  OverviewMetrics,
  PipelineCounts,
  PortalFilters,
  ScheduleRow,
  TaxSlice,
} from "@/lib/types";

const shortMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
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

const classLabel: Record<string, string> = {
  standard: "Standard 18%",
  financial_services: "Financial services 20.5%",
  zero_rated: "Zero-rated exports",
  exempt: "Exempt",
};

const serialPattern = /^(\d{2}[A-Z]{3})_([A-Z0-9]+)_(\d+)$/;

export function formatMoney(value: string | number): string {
  return `LKR ${Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return `${day} ${shortMonths[month - 1]} ${year}`;
}

export function formatStamp(value: string): string {
  const date = new Date(value);
  const day = date.getUTCDate();
  const month = shortMonths[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  return `${day} ${month} ${year}, ${hour}:${minute} UTC`;
}

export function monthTitle(period: string): string {
  const [year, month] = period.slice(0, 10).split("-").map(Number);
  return `${fullMonths[month - 1]} ${year}`;
}

export function labelStatus(status: string): InvoiceStatus {
  const label = statusLabel[status];
  if (!label) {
    throw new Error(`ramis status ${status} has no portal label`);
  }
  return label;
}

function tagsFor(input: {
  tin: string;
  supplyDate: string;
  net: string;
  vat: string;
  total: string;
  note?: string;
}): string[] {
  const tags: string[] = [];
  if (!/^\d{9}$/.test(input.tin)) tags.push("INVALID_TIN_FORMAT");
  if (!input.supplyDate) tags.push("MISSING_SUPPLY_DATE");
  const net = Number(input.net);
  const vat = Number(input.vat);
  const total = Number(input.total);
  if (Math.round((net + vat) * 100) !== Math.round(total * 100)) tags.push("MATH_RECONCILIATION_FAIL");
  if (input.note && /^[A-Z0-9_]+$/.test(input.note) && !tags.includes(input.note)) tags.push(input.note);
  return tags;
}

export function buildDocuments(input: {
  invoices: OutboundInvoiceRow[];
  adjustments: OutboundAdjustmentRow[];
  branchCode: Map<number, string>;
  branchName: Map<number, string>;
  entityName: Map<number, string>;
}): ScopedDocument[] {
  const invoiceById = new Map(input.invoices.map((invoice) => [invoice.id, invoice]));
  const documents = [
    ...input.invoices.map((row) => ({
      at: row.created_at,
      invoice: {
        id: `invoice-${row.id}`,
        source: "invoice" as const,
        sourceId: String(row.id),
        serial: row.serial_number ?? "—",
        buyer: row.customer_name,
        buyerTin: row.customer_tin,
        invoiceDate: formatDate(row.invoice_date),
        supplyDate: formatDate(row.supply_date),
        amount: formatMoney(row.amount_exclusive_vat),
        vat: formatMoney(row.vat_amount),
        total: formatMoney(row.total_amount),
        status: labelStatus(row.ramis_status),
        branch: input.branchName.get(row.branch_id) ?? input.branchCode.get(row.branch_id) ?? String(row.branch_id),
        entity: input.entityName.get(row.legal_entity_id) ?? String(row.legal_entity_id),
        entityId: String(row.legal_entity_id),
        kind: "Tax invoice" as const,
        schedule: "01" as const,
        note: row.error_message ?? undefined,
        token: row.ramis_clearance_token ?? undefined,
        tags: tagsFor({
          tin: row.customer_tin,
          supplyDate: row.supply_date,
          net: row.amount_exclusive_vat,
          vat: row.vat_amount,
          total: row.total_amount,
          note: row.error_message ?? undefined,
        }),
        invoiceClass: row.invoice_type,
        netValue: Number(row.amount_exclusive_vat),
        vatValue: Number(row.vat_amount),
        totalValue: Number(row.total_amount),
        cleared: row.ramis_status === "cleared",
        day: row.invoice_date.slice(0, 10),
        month: monthKey(row.invoice_date),
      },
    })),
    ...input.adjustments.map((row) => {
      const original = invoiceById.get(row.original_invoice_id);
      const credit = row.adjustment_type === "credit_note";
      return {
        at: row.created_at,
        invoice: {
          id: `adjustment-${row.id}`,
          source: "adjustment" as const,
          sourceId: String(row.id),
          serial: row.serial_number ?? "—",
          buyer: original?.customer_name ?? row.reason,
          buyerTin: original?.customer_tin ?? "",
          invoiceDate: formatDate(row.adjustment_date),
          supplyDate: formatDate(row.adjustment_date),
          amount: formatMoney(row.adjusted_amount_exclusive_vat),
          vat: formatMoney(row.adjusted_vat_amount),
          total: formatMoney(row.adjusted_total_amount),
          status: labelStatus(row.ramis_status),
          branch: input.branchName.get(row.branch_id) ?? input.branchCode.get(row.branch_id) ?? String(row.branch_id),
          entity: input.entityName.get(row.legal_entity_id) ?? String(row.legal_entity_id),
          entityId: String(row.legal_entity_id),
          kind: credit ? ("Credit note" as const) : ("Debit note" as const),
          schedule: "04" as const,
          note: row.error_message ?? undefined,
          token: row.ramis_clearance_token ?? undefined,
          parentSerial: row.original_serial_number,
          parentDate: formatDate(row.original_invoice_date),
          reason: row.reason,
          tags: tagsFor({
            tin: original?.customer_tin ?? "",
            supplyDate: row.original_invoice_date,
            net: row.adjusted_amount_exclusive_vat,
            vat: row.adjusted_vat_amount,
            total: row.adjusted_total_amount,
            note: row.error_message ?? undefined,
          }),
          invoiceClass: original?.invoice_type ?? "standard",
          netValue: Number(row.adjusted_amount_exclusive_vat),
          vatValue: Number(row.adjusted_vat_amount),
          totalValue: Number(row.adjusted_total_amount),
          cleared: row.ramis_status === "cleared",
          day: row.adjustment_date.slice(0, 10),
          month: monthKey(row.adjustment_date),
        },
      };
    }),
  ].sort((left, right) => (left.at < right.at ? 1 : -1));

  const serialCount = new Map<string, number>();
  for (const item of documents) {
    if (item.invoice.serial === "—") continue;
    const key = `${item.invoice.entityId}:${item.invoice.serial}`;
    serialCount.set(key, (serialCount.get(key) ?? 0) + 1);
  }

  return documents.map((item) => {
    const key = `${item.invoice.entityId}:${item.invoice.serial}`;
    const tags = [...item.invoice.tags];
    if ((serialCount.get(key) ?? 0) > 1 && !tags.includes("DUPLICATE_SERIAL")) {
      tags.push("DUPLICATE_SERIAL");
    }
    const { invoiceClass, netValue, vatValue, totalValue, cleared, day, month, ...invoice } = item.invoice;
    return {
      ...invoice,
      tags,
      invoiceClass,
      netValue,
      vatValue,
      totalValue,
      cleared,
      day,
      month,
    };
  });
}

export type ScopedDocument = Invoice & {
  invoiceClass: string;
  netValue: number;
  vatValue: number;
  totalValue: number;
  cleared: boolean;
  day: string;
  month: string;
};

export function matchesOutbound(document: Invoice, filters: PortalFilters): boolean {
  if (filters.schedule === "02") return false;
  if (filters.schedule !== "all" && document.schedule !== filters.schedule) return false;
  if (filters.status !== "all" && document.status !== filters.status) return false;
  return true;
}

export function buildGaps(documents: ScopedDocument[]): GapRow[] {
  const groups = new Map<string, Set<number>>();
  for (const document of documents) {
    const match = serialPattern.exec(document.serial);
    if (!match) continue;
    const key = `${match[1]}|${match[2]}`;
    const sequences = groups.get(key) ?? new Set<number>();
    sequences.add(Number(match[3]));
    groups.set(key, sequences);
  }

  return [...groups.entries()]
    .map(([key, sequences]) => {
      const [period, branch] = key.split("|");
      const ordered = [...sequences].sort((left, right) => left - right);
      const missing: string[] = [];
      for (let value = ordered[0]; value <= ordered[ordered.length - 1]; value += 1) {
        if (!sequences.has(value)) missing.push(String(value).padStart(5, "0"));
      }
      return {
        period,
        branch,
        from: String(ordered[0]).padStart(5, "0"),
        to: String(ordered[ordered.length - 1]).padStart(5, "0"),
        issued: ordered.length,
        missing,
      };
    })
    .sort((left, right) => `${left.period}${left.branch}`.localeCompare(`${right.period}${right.branch}`));
}

export function buildPipeline(documents: ScopedDocument[]): PipelineCounts {
  return {
    cleared: documents.filter((document) => document.status === "Cleared").length,
    submitting: documents.filter((document) => document.status === "Submitting").length,
    rejected: documents.filter((document) => document.status === "Rejected").length,
    skipped: documents.filter((document) => document.status === "Skipped").length,
  };
}

function dueOn(period: string): string {
  const [year, month] = period.split("-").map(Number);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `20 ${fullMonths[nextMonth - 1]} ${nextYear}`;
}

export function buildMetrics(
  documents: ScopedDocument[],
  purchases: Array<ScheduleRow & { vatValue: number; approved: boolean; month: string }>,
  period: string,
): OverviewMetrics {
  const activeMonth =
    period !== "all"
      ? period
      : documents.reduce((latest, document) => (document.month > latest ? document.month : latest), "");
  const sales = documents.filter((document) => document.schedule === "01" && document.cleared);
  const credits = documents.filter(
    (document) => document.schedule === "04" && document.kind === "Credit note" && document.cleared,
  );
  const debits = documents.filter(
    (document) => document.schedule === "04" && document.kind === "Debit note" && document.cleared,
  );
  const outputVat = sales.reduce((sum, document) => sum + document.vatValue, 0);
  const creditVat = credits.reduce((sum, document) => sum + document.vatValue, 0);
  const debitVat = debits.reduce((sum, document) => sum + document.vatValue, 0);
  const approved = purchases.filter((row) => row.approved);
  const inputVat = approved.reduce((sum, row) => sum + row.vatValue, 0);
  const adjustmentVat = creditVat - debitVat;
  const net = outputVat - inputVat - adjustmentVat;
  const considered = documents.filter((document) => document.status !== "Skipped");
  const cleared = documents.filter((document) => document.status === "Cleared").length;
  const salesTotal = sales.reduce((sum, document) => sum + document.totalValue, 0);
  const creditTotal = credits.reduce((sum, document) => sum + document.totalValue, 0);
  const ratio = salesTotal === 0 ? 0 : creditTotal / salesTotal;
  const classTotals = new Map<string, number>();
  for (const document of sales) {
    const label = classLabel[document.invoiceClass] ?? document.invoiceClass;
    classTotals.set(label, (classTotals.get(label) ?? 0) + document.netValue);
  }
  const classSum = [...classTotals.values()].reduce((sum, value) => sum + value, 0);
  const taxMix: TaxSlice[] = [...classTotals.entries()].map(([label, amount]) => ({
    label,
    amount: formatMoney(amount),
    share: classSum === 0 ? "0%" : `${Math.round((amount / classSum) * 100)}%`,
  }));
  const daily = dailySeries(sales, activeMonth);

  return {
    outputVat: formatMoney(outputVat),
    inputVat: formatMoney(inputVat),
    adjustmentVat: formatMoney(adjustmentVat),
    netVat: formatMoney(net),
    clearanceRate: considered.length === 0 ? "—" : `${((cleared / considered.length) * 100).toFixed(1)}%`,
    inFlight: documents.filter((document) => document.status === "Submitting").length,
    rejected: documents.filter((document) => document.status === "Rejected").length,
    inputAtRisk: formatMoney(purchases.filter((row) => !row.approved).reduce((sum, row) => sum + row.vatValue, 0)),
    creditNoteRatio: salesTotal === 0 ? "—" : `${(ratio * 100).toFixed(1)}%`,
    creditNoteElevated: ratio > 0.05,
    taxMix,
    daily,
    dueLabel: activeMonth ? dueOn(activeMonth) : "the 20th of the following month",
    seriesLabel: activeMonth ? periodLabel(activeMonth) : "this month",
  };
}

function dailySeries(sales: ScopedDocument[], month: string): DailyPoint[] {
  if (!month) return [];
  const [year, monthNumber] = month.split("-").map(Number);
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const counts = new Map<string, number>();
  for (const document of sales) {
    if (document.month !== month) continue;
    counts.set(document.day, (counts.get(document.day) ?? 0) + 1);
  }
  return Array.from({ length: days }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    const key = `${month}-${day}`;
    return { label: String(index + 1), count: counts.get(key) ?? 0 };
  });
}

export function describePeriod(period: string): string {
  return period === "all" ? "All periods" : periodLabel(period);
}
