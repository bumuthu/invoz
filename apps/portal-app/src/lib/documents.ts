import { monthKey, periodLabel } from "@/lib/filters";
import type {
  DailyPoint,
  GapRow,
  Invoice,
  InvoiceStatus,
  OverviewMetrics,
  PipelineCounts,
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

export type PortalInvoiceSource = {
  id: number;
  created_at: string;
  serial_number: string | null;
  customer_name: string;
  customer_tin: string;
  invoice_date: string;
  supply_date: string;
  amount_exclusive_vat: string;
  vat_amount: string;
  total_amount: string;
  ramis_status: string;
  branch_id: number;
  legal_entity_id: number;
  error_message: string | null;
  ramis_clearance_token: string | null;
  invoice_type: string;
};

export type PortalAdjustmentSource = {
  id: number;
  created_at: string;
  serial_number: string | null;
  adjustment_type: string;
  customer_name: string | null;
  customer_tin: string | null;
  reason: string;
  adjustment_date: string;
  adjusted_amount_exclusive_vat: string;
  adjusted_vat_amount: string;
  adjusted_total_amount: string;
  ramis_status: string;
  branch_id: number;
  legal_entity_id: number;
  error_message: string | null;
  ramis_clearance_token: string | null;
  original_invoice_id: number;
  original_serial_number: string;
  original_invoice_date: string;
  original_customer_name: string | null;
  original_customer_tin: string | null;
  original_invoice_type: string | null;
};

export function buildDocuments(input: {
  invoices: PortalInvoiceSource[];
  adjustments: PortalAdjustmentSource[];
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
        schedule: row.invoice_type === "zero_rated" ? ("07" as const) : ("01" as const),
        edit: {
          invoiceDate: row.invoice_date.slice(0, 10),
          supplyDate: row.supply_date.slice(0, 10),
          net: row.amount_exclusive_vat,
          vat: row.vat_amount,
          total: row.total_amount,
          parentDate: "",
        },
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
      const buyer = row.customer_name ?? original?.customer_name ?? row.original_customer_name ?? row.reason;
      const buyerTin = row.customer_tin ?? original?.customer_tin ?? row.original_customer_tin ?? "";
      return {
        at: row.created_at,
        invoice: {
          id: `adjustment-${row.id}`,
          source: "adjustment" as const,
          sourceId: String(row.id),
          serial: row.serial_number ?? "—",
          buyer,
          buyerTin,
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
          edit: {
            invoiceDate: row.adjustment_date.slice(0, 10),
            supplyDate: row.adjustment_date.slice(0, 10),
            net: row.adjusted_amount_exclusive_vat,
            vat: row.adjusted_vat_amount,
            total: row.adjusted_total_amount,
            parentDate: row.original_invoice_date.slice(0, 10),
          },
          note: row.error_message ?? undefined,
          token: row.ramis_clearance_token ?? undefined,
          parentSerial: row.original_serial_number,
          parentDate: formatDate(row.original_invoice_date),
          reason: row.reason,
          tags: tagsFor({
            tin: buyerTin,
            supplyDate: row.original_invoice_date,
            net: row.adjusted_amount_exclusive_vat,
            vat: row.adjusted_vat_amount,
            total: row.adjusted_total_amount,
            note: row.error_message ?? undefined,
          }),
          invoiceClass: original?.invoice_type ?? row.original_invoice_type ?? "standard",
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

export function buildGapsFromSerials(serials: Array<string | null | undefined>): GapRow[] {
  const groups = new Map<string, Set<number>>();
  for (const serial of serials) {
    if (!serial) continue;
    const match = serialPattern.exec(serial);
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

export function buildGaps(documents: ScopedDocument[]): GapRow[] {
  return buildGapsFromSerials(documents.map((document) => document.serial));
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

export function aggregateMetrics(input: {
  period: string;
  latestMonth: string;
  salesVat: number;
  salesTotal: number;
  salesNetByClass: Array<{ invoiceClass: string; net: number }>;
  clearedSalesByDay: Array<{ day: string; count: number }>;
  creditVat: number;
  creditTotal: number;
  debitVat: number;
  approvedInputVat: number;
  unapprovedInputVat: number;
  cleared: number;
  submitting: number;
  rejected: number;
  skipped: number;
  total: number;
}): OverviewMetrics {
  const activeMonth = input.period !== "all" ? input.period : input.latestMonth;
  const adjustmentVat = input.creditVat - input.debitVat;
  const net = input.salesVat - input.approvedInputVat - adjustmentVat;
  const considered = input.total - input.skipped;
  const ratio = input.salesTotal === 0 ? 0 : input.creditTotal / input.salesTotal;
  const classSum = input.salesNetByClass.reduce((sum, row) => sum + row.net, 0);
  const taxMix: TaxSlice[] = input.salesNetByClass.map((row) => ({
    label: classLabel[row.invoiceClass] ?? row.invoiceClass,
    amount: formatMoney(row.net),
    share: classSum === 0 ? "0%" : `${Math.round((row.net / classSum) * 100)}%`,
  }));
  const dayCounts = new Map(input.clearedSalesByDay.map((row) => [row.day, row.count]));

  return {
    outputVat: formatMoney(input.salesVat),
    inputVat: formatMoney(input.approvedInputVat),
    adjustmentVat: formatMoney(adjustmentVat),
    netVat: formatMoney(net),
    clearanceRate: considered <= 0 ? "—" : `${((input.cleared / considered) * 100).toFixed(1)}%`,
    inFlight: input.submitting,
    rejected: input.rejected,
    inputAtRisk: formatMoney(input.unapprovedInputVat),
    creditNoteRatio: input.salesTotal === 0 ? "—" : `${(ratio * 100).toFixed(1)}%`,
    creditNoteElevated: ratio > 0.05,
    taxMix,
    daily: dailyCounts(dayCounts, activeMonth),
    dueLabel: activeMonth ? dueOn(activeMonth) : "the 20th of the following month",
    seriesLabel: activeMonth ? periodLabel(activeMonth) : "this month",
  };
}

export function buildMetrics(
  documents: ScopedDocument[],
  purchases: Array<ScheduleRow & { vatValue: number; approved: boolean; month: string }>,
  period: string,
): OverviewMetrics {
  const sales = documents.filter((document) => document.schedule === "01" && document.cleared);
  const credits = documents.filter(
    (document) => document.schedule === "04" && document.kind === "Credit note" && document.cleared,
  );
  const debits = documents.filter(
    (document) => document.schedule === "04" && document.kind === "Debit note" && document.cleared,
  );
  const classTotals = new Map<string, number>();
  for (const document of sales) {
    classTotals.set(document.invoiceClass, (classTotals.get(document.invoiceClass) ?? 0) + document.netValue);
  }
  const dayCounts = new Map<string, number>();
  for (const document of sales) {
    dayCounts.set(document.day, (dayCounts.get(document.day) ?? 0) + 1);
  }

  return aggregateMetrics({
    period,
    latestMonth: documents.reduce((latest, document) => (document.month > latest ? document.month : latest), ""),
    salesVat: sales.reduce((sum, document) => sum + document.vatValue, 0),
    salesTotal: sales.reduce((sum, document) => sum + document.totalValue, 0),
    salesNetByClass: [...classTotals.entries()].map(([invoiceClass, net]) => ({ invoiceClass, net })),
    clearedSalesByDay: [...dayCounts.entries()].map(([day, count]) => ({ day, count })),
    creditVat: credits.reduce((sum, document) => sum + document.vatValue, 0),
    creditTotal: credits.reduce((sum, document) => sum + document.totalValue, 0),
    debitVat: debits.reduce((sum, document) => sum + document.vatValue, 0),
    approvedInputVat: purchases.filter((row) => row.approved).reduce((sum, row) => sum + row.vatValue, 0),
    unapprovedInputVat: purchases.filter((row) => !row.approved).reduce((sum, row) => sum + row.vatValue, 0),
    cleared: documents.filter((document) => document.status === "Cleared").length,
    submitting: documents.filter((document) => document.status === "Submitting").length,
    rejected: documents.filter((document) => document.status === "Rejected").length,
    skipped: documents.filter((document) => document.status === "Skipped").length,
    total: documents.length,
  });
}

function dailyCounts(counts: Map<string, number>, month: string): DailyPoint[] {
  if (!month) return [];
  const [year, monthNumber] = month.split("-").map(Number);
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return Array.from({ length: days }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    const key = `${month}-${day}`;
    return { label: String(index + 1), count: counts.get(key) ?? 0 };
  });
}

export function describePeriod(period: string): string {
  return period === "all" ? "All periods" : periodLabel(period);
}
