import { isTin } from "@invoz/common";
import { parseCsv } from "./csv";

export type MappedInvoice = {
  erpReference: string;
  invoiceDate: string;
  supplyDate: string;
  buyerTin: string;
  buyerName: string;
  branchCode: string;
  netAmount: string;
  vatAmount: string;
  totalAmount: string;
};

const fields = {
  "Invoice date": "invoiceDate",
  "Supply date": "supplyDate",
  "Buyer TIN": "buyerTin",
  "Buyer name": "buyerName",
  "Branch code": "branchCode",
  "Net amount": "netAmount",
  "VAT amount": "vatAmount",
} as const;

type FieldKey = (typeof fields)[keyof typeof fields];

export function invoicesFromCsv(
  csv: string,
  mappings: { source_column: string; target_field: string }[],
): MappedInvoice[] {
  const rows = parseCsv(csv);
  const header = rows[0];
  if (!header) {
    throw new Error("invoice file has no header");
  }

  const columns = new Map<FieldKey, number>();
  for (const mapping of mappings) {
    const field = fields[mapping.target_field as keyof typeof fields];
    if (!field) continue;
    const index = header.indexOf(mapping.source_column);
    if (index < 0) {
      throw new Error(`invoice file is missing column ${mapping.source_column}`);
    }
    columns.set(field, index);
  }
  for (const [target, field] of Object.entries(fields)) {
    if (!columns.has(field)) {
      throw new Error(`field mapping has no ${target} column`);
    }
  }

  const referenceIndex = header.findIndex((name) => /invoice\s*no/i.test(name));
  if (referenceIndex < 0) {
    throw new Error("invoice file is missing the invoice number column");
  }

  const invoices: MappedInvoice[] = [];
  for (const row of rows.slice(1)) {
    if (row.every((value) => value.trim() === "")) continue;
    const read = (field: FieldKey) => (row[columns.get(field) ?? -1] ?? "").trim();
    const netAmount = money(read("netAmount"), "Net amount");
    const vatAmount = money(read("vatAmount"), "VAT amount");
    const buyerTin = read("buyerTin");
    if (!isTin(buyerTin)) {
      throw new Error("buyer TIN must be 9 digits");
    }
    const invoiceDate = date(read("invoiceDate"), "Invoice date");
    const supplyDate = date(read("supplyDate"), "Supply date");
    invoices.push({
      erpReference: (row[referenceIndex] ?? "").trim(),
      invoiceDate,
      supplyDate,
      buyerTin,
      buyerName: required(read("buyerName"), "Buyer name"),
      branchCode: required(read("branchCode"), "Branch code"),
      netAmount,
      vatAmount,
      totalAmount: (Number(netAmount) + Number(vatAmount)).toFixed(2),
    });
  }
  if (invoices.length === 0) {
    throw new Error("invoice file has no invoices");
  }
  if (invoices.some((invoice) => invoice.erpReference === "")) {
    throw new Error("invoice number is required");
  }
  return invoices;
}

function required(value: string, field: string): string {
  if (!value) throw new Error(`${field} is required`);
  return value;
}

function date(value: string, field: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${field} must be YYYY-MM-DD`);
  }
  return value;
}

function money(value: string, field: string): string {
  if (!/^\d+(\.\d+)?$/.test(value)) {
    throw new Error(`${field} must be numeric`);
  }
  return Number(value).toFixed(2);
}
