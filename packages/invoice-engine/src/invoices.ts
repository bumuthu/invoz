import { isTin } from "@invoz/common";
import { invoiceFields, optionalColumn, requireColumn } from "./columns";
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
  invoiceType?: string;
};

export function invoicesFromCsv(csv: string, mapping: Record<string, string>, branchCode: string): MappedInvoice[] {
  if (!branchCode) throw new Error("invoice file is not in a branch folder");
  const rows = parseCsv(csv);
  const header = rows[0];
  if (!header) throw new Error("invoice file has no header");

  const columns = new Map<string, number>();
  for (const field of invoiceFields) columns.set(field, requireColumn(header, mapping, field));
  const typeIndex = optionalColumn(header, mapping, "header.invoice_type");

  const read = (row: string[], field: (typeof invoiceFields)[number]) => (row[columns.get(field) ?? -1] ?? "").trim();
  const invoices: MappedInvoice[] = [];
  for (const row of rows.slice(1)) {
    if (row.every((value) => value.trim() === "")) continue;
    const netAmount = money(read(row, "currency_summary.total_value_excluding_vat"), "currency_summary.total_value_excluding_vat");
    const vatAmount = money(read(row, "currency_summary.total_vat_amount"), "currency_summary.total_vat_amount");
    const buyerTin = read(row, "purchaser.tin");
    if (!isTin(buyerTin)) throw new Error("buyer TIN must be 9 digits");
    invoices.push({
      erpReference: required(read(row, "header.erp_reference"), "header.erp_reference"),
      invoiceDate: date(read(row, "header.invoice_date"), "header.invoice_date"),
      supplyDate: date(read(row, "header.supply_date"), "header.supply_date"),
      buyerTin,
      buyerName: required(read(row, "purchaser.name"), "purchaser.name"),
      branchCode,
      netAmount,
      vatAmount,
      totalAmount: (Number(netAmount) + Number(vatAmount)).toFixed(2),
      invoiceType: typeIndex === undefined ? undefined : (row[typeIndex] ?? "").trim(),
    });
  }
  if (invoices.length === 0) throw new Error("invoice file has no invoices");
  return invoices;
}

function required(value: string, field: string): string {
  if (!value) throw new Error(`${field} is required`);
  return value;
}

function date(value: string, field: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${field} must be YYYY-MM-DD`);
  return value;
}

function money(value: string, field: string): string {
  if (!/^\d+(\.\d+)?$/.test(value)) throw new Error(`${field} must be numeric`);
  return Number(value).toFixed(2);
}
