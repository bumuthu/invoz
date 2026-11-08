export const pageSize = 100;
export const maxPages = 5;

const csvColumns = [
  "header.erp_reference",
  "header.invoice_date",
  "header.supply_date",
  "purchaser.tin",
  "purchaser.name",
  "currency_summary.total_value_excluding_vat",
  "currency_summary.total_vat_amount",
] as const;

export type CsvColumn = (typeof csvColumns)[number];

export type BranchRef = {
  id: number;
  code: string;
};

export type PolledInvoice = {
  id: string;
  invoiceDate: string;
  supplyDate: string;
  buyerTin: string;
  buyerName: string;
  netAmount: string;
  vatAmount: string;
  branchId: number;
};

export function billingDocumentUrl(endpoint: string, lastInvoiceId: string | null): string {
  const typeFilter = "(BillingDocumentType eq 'F2' or BillingDocumentType eq 'FX')";
  const filter = lastInvoiceId
    ? `BillingDocument gt '${odataString(lastInvoiceId)}' and ${typeFilter}`
    : typeFilter;
  const query = [
    "$format=json",
    `$orderby=${encodeURIComponent("BillingDocument asc")}`,
    `$top=${pageSize}`,
    `$filter=${encodeURIComponent(filter)}`,
  ].join("&");
  return `${collectionUrl(endpoint)}?${query}`;
}

export function collectionUrl(endpoint: string): string {
  const root = endpoint.trim().replace(/\/$/, "");
  if (!root) throw new Error("SAP endpoint is empty");
  if (root.endsWith("/A_BillingDocument")) return root;
  return `${root}/A_BillingDocument`;
}

export function sameOrigin(nextUrl: string, endpoint: string): string {
  const next = new URL(nextUrl, endpoint);
  const root = new URL(endpoint);
  if (next.origin !== root.origin) throw new Error("SAP next page is on a different host");
  return next.toString();
}

export function parseBillingPage(payload: unknown): {
  documents: Record<string, unknown>[];
  nextUrl: string | null;
} {
  if (!isRecord(payload)) throw new Error("SAP response was not JSON");
  if (Array.isArray(payload.value)) {
    return {
      documents: payload.value.filter(isRecord),
      nextUrl: typeof payload["@odata.nextLink"] === "string" ? payload["@odata.nextLink"] : null,
    };
  }
  if (isRecord(payload.d) && Array.isArray(payload.d.results)) {
    return {
      documents: payload.d.results.filter(isRecord),
      nextUrl: typeof payload.d.__next === "string" ? payload.d.__next : null,
    };
  }
  throw new Error("SAP response has no billing documents");
}

export function mapBillingDocument(
  document: Record<string, unknown>,
  branches: BranchRef[],
): PolledInvoice | null {
  const id = readString(document, "BillingDocument");
  if (!id) throw new Error("SAP billing document has no invoice id");
  if (cancelled(document)) return null;
  const invoiceDate = sapDate(readString(document, "BillingDocumentDate"), id);
  return {
    id,
    invoiceDate,
    supplyDate: invoiceDate,
    buyerTin: buyerTin(readString(document, "VATRegistration"), id),
    buyerName: required(readString(document, "SoldToPartyName", "SoldToParty"), "buyer name", id),
    netAmount: sapMoney(readString(document, "TotalNetAmount"), "net amount", id),
    vatAmount: sapMoney(readString(document, "TaxAmount"), "VAT amount", id),
    branchId: resolveBranchId(branches, readString(document, "CompanyCode"), id),
  };
}

export function resolveBranchId(branches: BranchRef[], companyCode: string, invoiceId: string): number {
  const match = branches.filter((branch) => branch.code === companyCode);
  if (match.length === 1) return match[0].id;
  if (branches.length === 1) return branches[0].id;
  const detail = companyCode ? `company code ${companyCode}` : "no company code";
  throw new Error(`billing document ${invoiceId} has ${detail} and the legal entity has ${branches.length} branches`);
}

export function csvHeaders(mappings: { ramisField: string; erpField: string }[]): string[] {
  return csvColumns.map((ramisField) => {
    const row = mappings.find((item) => item.ramisField === ramisField);
    if (!row?.erpField) throw new Error(`field mapping has no ${ramisField} column`);
    return row.erpField;
  });
}

export function invoiceCsv(headers: string[], invoice: PolledInvoice): string {
  const values = [
    invoice.id,
    invoice.invoiceDate,
    invoice.supplyDate,
    invoice.buyerTin,
    invoice.buyerName,
    invoice.netAmount,
    invoice.vatAmount,
  ];
  return `${headers.map(csvCell).join(",")}\n${values.map(csvCell).join(",")}\n`;
}

export function invoiceObjectKey(input: {
  organizationId: number;
  legalEntityId: number;
  branchId: number;
  erpCode: string;
  invoiceId: string;
}): string {
  const safeId = input.invoiceId.replace(/[^A-Za-z0-9._-]/g, "");
  const safeCode = input.erpCode.replace(/[^a-z0-9_]/g, "");
  if (!safeId) throw new Error("invoice id is empty");
  if (!safeCode) throw new Error("erp code is empty");
  return `uploads/${input.organizationId}/${input.legalEntityId}/${input.branchId}/inbound/poll-${safeCode}-${safeId}.csv`;
}

export function documentId(document: Record<string, unknown>): string {
  const value = document.BillingDocument;
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

export function compareInvoiceId(left: string, right: string): number {
  if (/^\d+$/.test(left) && /^\d+$/.test(right)) {
    const a = BigInt(left);
    const b = BigInt(right);
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  }
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function sapDate(value: string, invoiceId: string): string {
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  if (iso) return iso[1];
  const ticks = /^\/Date\((-?\d+)(?:[+-]\d+)?\)\/$/.exec(value);
  if (ticks) {
    const date = new Date(Number(ticks[1]));
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }
  throw new Error(`billing document ${invoiceId} invoice date must be YYYY-MM-DD`);
}

export function buyerTin(value: string, invoiceId: string): string {
  const digits = value.replace(/\D/g, "");
  if (!/^[0-9]{9}$/.test(digits)) {
    throw new Error(`billing document ${invoiceId} buyer TIN must be 9 digits`);
  }
  return digits;
}

export function sapMoney(value: string, field: string, invoiceId: string): string {
  const normalized = value.replace(/,/g, "").trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error(`billing document ${invoiceId} ${field} must be numeric`);
  }
  return Number(normalized).toFixed(2);
}

function odataString(value: string): string {
  return value.replace(/'/g, "''");
}

function cancelled(document: Record<string, unknown>): boolean {
  const value = document.BillingDocumentIsCancelled;
  return value === true || value === "true" || value === "X";
}

function required(value: string, field: string, invoiceId: string): string {
  if (!value) throw new Error(`billing document ${invoiceId} ${field} is required`);
  return value;
}

function readString(document: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = document[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
