import { parseCsv } from "./csv";

export const invoiceFields = [
  "header.erp_reference",
  "header.invoice_date",
  "header.supply_date",
  "purchaser.tin",
  "purchaser.name",
  "currency_summary.total_value_excluding_vat",
  "currency_summary.total_vat_amount",
] as const;

export const adjustmentFields = [
  "header.adjustment_serial_number",
  "header.adjustment_type",
  "header.adjustment_date",
  "header.original_invoice_serial_number",
  "header.original_invoice_date",
  "header.adjustment_reason",
  "purchaser.tin",
  "purchaser.name",
  "adjustment_values.adjusted_value_excluding_vat",
  "adjustment_values.vat_rate",
  "adjustment_values.adjusted_vat_amount",
  "adjustment_values.adjusted_total_consideration",
] as const;

export function erpColumn(mapping: Record<string, string>, ramisField: string): string | undefined {
  for (const [erpField, field] of Object.entries(mapping)) {
    if (field === ramisField) return erpField;
  }
  return undefined;
}

export function requireColumn(header: string[], mapping: Record<string, string>, ramisField: string): number {
  const name = erpColumn(mapping, ramisField);
  if (!name) throw new Error(`field mapping has no ${ramisField} column`);
  const index = header.indexOf(name);
  if (index < 0) throw new Error(`invoice file is missing column ${name}`);
  return index;
}

export function optionalColumn(header: string[], mapping: Record<string, string>, ramisField: string): number | undefined {
  const name = erpColumn(mapping, ramisField);
  if (!name) return undefined;
  const index = header.indexOf(name);
  return index < 0 ? undefined : index;
}

export function isAdjustmentHeader(header: string[], mapping: Record<string, string>): boolean {
  const column = erpColumn(mapping, "header.adjustment_type");
  return Boolean(column && header.includes(column));
}

export function invoiceMapping(
  csv: string,
  sales: Record<string, string>,
  zeroRated: Record<string, string>,
): Record<string, string> {
  const rows = parseCsv(csv);
  const header = rows[0];
  if (!header) throw new Error("invoice file has no header");
  const salesFits = fits(header, sales);
  const exportFits = fits(header, zeroRated);
  if (salesFits && exportFits) {
    const typeIndex = optionalColumn(header, sales, "header.invoice_type") ?? optionalColumn(header, zeroRated, "header.invoice_type");
    const types = typeIndex === undefined ? [] : values(rows, typeIndex);
    const zeroRatedFile = types.length > 0 && types.every((type) => type === "ZERO_RATED" || type === "ZERO_RATED_INVOICE");
    return zeroRatedFile ? zeroRated : sales;
  }
  if (exportFits) return zeroRated;
  return sales;
}

function fits(header: string[], mapping: Record<string, string>): boolean {
  return invoiceFields.every((field) => {
    const column = erpColumn(mapping, field);
    return Boolean(column && header.includes(column));
  });
}

function values(rows: string[][], index: number): string[] {
  return rows
    .slice(1)
    .filter((row) => row.some((value) => value.trim() !== ""))
    .map((row) => (row[index] ?? "").trim().toUpperCase())
    .filter((value) => value !== "");
}
