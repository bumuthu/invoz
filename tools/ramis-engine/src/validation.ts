import { Code, RamisError } from "./errors";
import { canonicalHash, centsDrift, expectedVatCents, toCents } from "./money";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"] as const;
const SERIAL = /^([0-9]{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)_([A-Za-z0-9]{1,15})_([A-Za-z0-9]+)$/;
const TIN = /^[0-9]{9}$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const IDEMPOTENCY =
  /^(?:[0-9a-fA-F]{64}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;

const INVOICE_RATES: Record<string, number> = {
  STANDARD_TAX_INVOICE: 1800,
  FINANCIAL_SERVICES: 2050,
  FINANCIAL_SERVICES_TAX_INVOICE: 2050,
  ZERO_RATED: 0,
  ZERO_RATED_INVOICE: 0,
  EXEMPT: 0,
  EXEMPT_INVOICE: 0,
};

export type Party = {
  tin: string;
  name: string;
  address: string | null;
};

export type NormalizedLine = {
  sequence: number;
  description: string;
  quantity: number;
  unitOfMeasure: string;
  unitPriceCents: number;
  netCents: number;
  vatRateBasisPoints: number;
  vatCents: number;
  totalCents: number;
};

export type NormalizedInvoice = {
  serialNumber: string;
  erpReference: string;
  invoiceDate: string;
  supplyDate: string;
  invoiceType: string;
  placeOfSupply: string | null;
  supplier: Party;
  purchaser: Party;
  currency: string;
  exchangeRateCents: number;
  netCents: number;
  vatRateBasisPoints: number;
  vatCents: number;
  totalCents: number;
  lineItems: NormalizedLine[];
  warnings: string[];
  hash: string;
};

export type NormalizedAdjustment = {
  serialNumber: string;
  adjustmentType: "TAX_CREDIT_NOTE" | "TAX_DEBIT_NOTE";
  adjustmentDate: string;
  originalSerialNumber: string;
  originalInvoiceDate: string;
  reason: string;
  supplier: Party;
  purchaser: Party;
  netCents: number;
  vatRateBasisPoints: number;
  vatCents: number;
  totalCents: number;
  hash: string;
};

export function requireIdempotencyKey(value: string | undefined): string {
  if (!value || !IDEMPOTENCY.test(value)) {
    throw new RamisError(
      422,
      Code.SCHEMA,
      "X-Idempotency-Key must be a UUID or a SHA-256 hex digest",
      "X-Idempotency-Key",
    );
  }
  return value;
}

export function requireClientTin(value: string | undefined): string {
  if (!value || !TIN.test(value)) {
    throw new RamisError(422, Code.TIN, "X-Client-TIN must be exactly 9 numeric digits", "X-Client-TIN");
  }
  return value;
}

export function parseInvoice(body: unknown, clientTin: string): NormalizedInvoice {
  const root = asObject(body, "body");
  const header = asObject(required(root, "header", "header"), "header");
  const supplier = parseParty(required(root, "supplier", "supplier"), "supplier", true);
  const purchaser = parseParty(required(root, "purchaser", "purchaser"), "purchaser", true);
  if (clientTin !== supplier.tin) {
    throw new RamisError(422, Code.TIN, "X-Client-TIN must be the supplier TIN submitting this invoice", "X-Client-TIN");
  }

  const invoiceDate = parseDate(required(header, "invoice_date", "header.invoice_date"), "header.invoice_date");
  const serialNumber = parseSerial(header.serial_number, "header.serial_number", invoiceDate, "invoice date");
  const supplyDate = parseSupplyDate(header.supply_date);
  const invoiceType = requireText(header.invoice_type, "header.invoice_type");
  const expectedRate = INVOICE_RATES[invoiceType];
  if (expectedRate === undefined) {
    throw new RamisError(
      422,
      Code.SCHEMA,
      "invoice_type must be STANDARD_TAX_INVOICE, FINANCIAL_SERVICES, ZERO_RATED, or EXEMPT",
      "header.invoice_type",
    );
  }

  const summary = asObject(required(root, "currency_summary", "currency_summary"), "currency_summary");
  const currency = summary.currency === undefined ? "LKR" : requireText(summary.currency, "currency_summary.currency").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new RamisError(422, Code.SCHEMA, "currency must be a 3-letter ISO code", "currency_summary.currency");
  }
  const exchangeRateCents = summary.exchange_rate === undefined ? 100 : toCents(summary.exchange_rate, "currency_summary.exchange_rate");
  if (exchangeRateCents <= 0) {
    throw new RamisError(422, Code.MATH, "exchange_rate must be greater than zero", "currency_summary.exchange_rate");
  }
  const netCents = positiveCents(summary.total_value_excluding_vat, "currency_summary.total_value_excluding_vat");
  const vatRate = toCents(summary.vat_rate ?? expectedRate / 100, "currency_summary.vat_rate");
  const vatCents = nonNegativeCents(summary.total_vat_amount, "currency_summary.total_vat_amount");
  const totalCents = positiveCents(summary.total_consideration_including_vat, "currency_summary.total_consideration_including_vat");
  if (vatRate !== expectedRate) {
    throw new RamisError(
      422,
      Code.MATH,
      `VAT rate ${formatRate(vatRate)} does not match ${invoiceType} (expected ${formatRate(expectedRate)})`,
      "currency_summary.vat_rate",
    );
  }
  assertBalanced(netCents, vatCents, totalCents, "currency_summary.total_consideration_including_vat");
  assertVat(netCents, vatRate, vatCents, "currency_summary.total_vat_amount");

  const lineItems = parseLines(root.line_items, vatRate);
  const lineNet = lineItems.reduce((sum, line) => sum + line.netCents, 0);
  const lineVat = lineItems.reduce((sum, line) => sum + line.vatCents, 0);
  const lineTotal = lineItems.reduce((sum, line) => sum + line.totalCents, 0);
  if (centsDrift(lineNet, netCents) || centsDrift(lineVat, vatCents) || centsDrift(lineTotal, totalCents)) {
    throw new RamisError(
      422,
      Code.MATH,
      "Line item totals do not reconcile to the currency summary",
      "line_items",
    );
  }

  const warnings: string[] = [];
  if (supplier.tin === purchaser.tin) warnings.push("Supplier TIN and purchaser TIN are the same");
  if (currency !== "LKR") {
    warnings.push("Foreign-currency invoice accepted; amounts are treated as the consideration already converted for VAT");
  }
  if (currency === "LKR" && exchangeRateCents !== 100) {
    warnings.push("LKR invoice exchange_rate is not 1");
  }
  const sequences = lineItems.map((line) => line.sequence);
  if (sequences.some((sequence, index) => sequence !== index + 1)) {
    warnings.push("item_sequence is not a contiguous series starting at 1");
  }

  const normalized: Omit<NormalizedInvoice, "hash"> = {
    serialNumber,
    erpReference: requireText(header.erp_reference, "header.erp_reference"),
    invoiceDate,
    supplyDate,
    invoiceType,
    placeOfSupply: optionalText(header.place_of_supply, "header.place_of_supply"),
    supplier,
    purchaser,
    currency,
    exchangeRateCents,
    netCents,
    vatRateBasisPoints: vatRate,
    vatCents,
    totalCents,
    lineItems,
    warnings,
  };
  return { ...normalized, hash: canonicalHash(normalized) };
}

export function parseAdjustment(body: unknown, clientTin: string): NormalizedAdjustment {
  const root = asObject(body, "body");
  const header = asObject(required(root, "header", "header"), "header");
  const supplier = parseParty(required(root, "supplier", "supplier"), "supplier", false);
  const purchaser = parseParty(required(root, "purchaser", "purchaser"), "purchaser", false);
  if (clientTin !== supplier.tin) {
    throw new RamisError(422, Code.TIN, "X-Client-TIN must be the supplier TIN submitting this adjustment", "X-Client-TIN");
  }

  const adjustmentType = requireText(header.adjustment_type, "header.adjustment_type");
  if (adjustmentType !== "TAX_CREDIT_NOTE" && adjustmentType !== "TAX_DEBIT_NOTE") {
    throw new RamisError(
      422,
      Code.SCHEMA,
      "adjustment_type must be TAX_CREDIT_NOTE or TAX_DEBIT_NOTE",
      "header.adjustment_type",
    );
  }
  const adjustmentDate = parseDate(required(header, "adjustment_date", "header.adjustment_date"), "header.adjustment_date");
  const serialNumber = parseSerial(
    header.adjustment_serial_number,
    "header.adjustment_serial_number",
    adjustmentDate,
    "adjustment date",
  );
  const originalInvoiceDate = parseDate(
    required(header, "original_invoice_date", "header.original_invoice_date"),
    "header.original_invoice_date",
  );
  const originalSerialNumber = requireText(header.original_invoice_serial_number, "header.original_invoice_serial_number");

  const values = asObject(required(root, "adjustment_values", "adjustment_values"), "adjustment_values");
  const netCents = positiveCents(values.adjusted_value_excluding_vat, "adjustment_values.adjusted_value_excluding_vat");
  const vatRate = toCents(values.vat_rate, "adjustment_values.vat_rate");
  const vatCents = nonNegativeCents(values.adjusted_vat_amount, "adjustment_values.adjusted_vat_amount");
  const totalCents = positiveCents(values.adjusted_total_consideration, "adjustment_values.adjusted_total_consideration");
  assertBalanced(netCents, vatCents, totalCents, "adjustment_values.adjusted_total_consideration");
  assertVat(netCents, vatRate, vatCents, "adjustment_values.adjusted_vat_amount");

  const normalized: Omit<NormalizedAdjustment, "hash"> = {
    serialNumber,
    adjustmentType,
    adjustmentDate,
    originalSerialNumber,
    originalInvoiceDate,
    reason: requireText(header.adjustment_reason, "header.adjustment_reason"),
    supplier,
    purchaser,
    netCents,
    vatRateBasisPoints: vatRate,
    vatCents,
    totalCents,
  };
  return { ...normalized, hash: canonicalHash(normalized) };
}

export function parseTaxPeriod(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    throw new RamisError(422, Code.SCHEMA, `${field} must be YYYY-MM`, field);
  }
  return value;
}

function parseLines(value: unknown, headerRate: number): NormalizedLine[] {
  if (value === undefined) {
    throw new RamisError(422, Code.MATH, "At least one line item is required", "line_items");
  }
  if (!Array.isArray(value) || value.length === 0) {
    throw new RamisError(422, Code.MATH, "At least one line item is required", "line_items");
  }
  return value.map((item, index) => {
    const field = `line_items[${index}]`;
    const line = asObject(item, field);
    const sequence = line.item_sequence;
    if (typeof sequence !== "number" || !Number.isInteger(sequence) || sequence < 1) {
      throw new RamisError(422, Code.SCHEMA, "item_sequence must be a positive integer", `${field}.item_sequence`);
    }
    const quantityCents = positiveCents(line.quantity, `${field}.quantity`);
    const unitPriceCents = nonNegativeCents(line.unit_price, `${field}.unit_price`);
    const netCents = nonNegativeCents(line.line_amount_excluding_vat, `${field}.line_amount_excluding_vat`);
    const extended = Math.round((quantityCents * unitPriceCents) / 100);
    if (centsDrift(extended, netCents)) {
      throw new RamisError(
        422,
        Code.MATH,
        "quantity × unit_price does not equal line_amount_excluding_vat",
        `${field}.line_amount_excluding_vat`,
      );
    }
    const vatRate = toCents(line.vat_rate, `${field}.vat_rate`);
    if (vatRate !== headerRate) {
      throw new RamisError(422, Code.MATH, "Line VAT rate does not match the invoice VAT rate", `${field}.vat_rate`);
    }
    const vatCents = nonNegativeCents(line.vat_amount, `${field}.vat_amount`);
    const totalCents = nonNegativeCents(line.line_total_including_vat, `${field}.line_total_including_vat`);
    assertVat(netCents, vatRate, vatCents, `${field}.vat_amount`);
    assertBalanced(netCents, vatCents, totalCents, `${field}.line_total_including_vat`);
    return {
      sequence,
      description: requireText(line.description, `${field}.description`),
      quantity: quantityCents / 100,
      unitOfMeasure: requireText(line.unit_of_measure, `${field}.unit_of_measure`),
      unitPriceCents,
      netCents,
      vatRateBasisPoints: vatRate,
      vatCents,
      totalCents,
    };
  });
}

function parseParty(value: unknown, field: string, addressRequired: boolean): Party {
  const party = asObject(value, field);
  const tin = stringifyTin(party.tin, `${field}.tin`);
  if (!TIN.test(tin)) {
    throw new RamisError(422, Code.TIN, `${field}.tin must be exactly 9 numeric digits`, `${field}.tin`);
  }
  const address = optionalText(party.address, `${field}.address`);
  if (addressRequired && !address) {
    throw new RamisError(422, Code.SCHEMA, `${field}.address is required`, `${field}.address`);
  }
  return { tin, name: requireText(party.name, `${field}.name`), address };
}

function parseSerial(value: unknown, field: string, isoDate: string, dateLabel: string): string {
  if (typeof value !== "string" || /\s/.test(value) || value.length === 0 || value.length > 40 || !SERIAL.test(value)) {
    throw new RamisError(
      422,
      Code.SERIAL,
      "Serial number must match YYMMM_QQQQ_XXXXX (max 40 characters, no spaces)",
      field,
    );
  }
  const expected = periodFor(isoDate);
  const actual = value.slice(0, 5);
  if (actual !== expected) {
    throw new RamisError(
      422,
      Code.PERIOD,
      `Serial prefix ${actual} does not match ${dateLabel} period ${expected}`,
      field,
    );
  }
  return value;
}

function parseSupplyDate(value: unknown): string {
  if (value === undefined || value === null || value === "") {
    throw new RamisError(422, Code.SUPPLY_DATE, "Supply date is required", "header.supply_date");
  }
  try {
    return parseDate(value, "header.supply_date");
  } catch (error) {
    if (error instanceof RamisError) {
      throw new RamisError(422, Code.SUPPLY_DATE, "Supply date is required and must be a calendar date", "header.supply_date");
    }
    throw error;
  }
}

function parseDate(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new RamisError(422, Code.SCHEMA, `${field} must be a calendar date (YYYY-MM-DD)`, field);
  }
  const match = DATE.exec(value);
  if (!match) throw new RamisError(422, Code.SCHEMA, `${field} must be a calendar date (YYYY-MM-DD)`, field);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new RamisError(422, Code.SCHEMA, `${field} must be a calendar date (YYYY-MM-DD)`, field);
  }
  return value;
}

function periodFor(isoDate: string): string {
  const month = Number(isoDate.slice(5, 7));
  return `${isoDate.slice(2, 4)}${MONTHS[month - 1]}`;
}

function assertBalanced(netCents: number, vatCents: number, totalCents: number, field: string): void {
  if (centsDrift(netCents + vatCents, totalCents)) {
    throw new RamisError(
      422,
      Code.MATH,
      "Math reconciliation failed: value excluding VAT plus VAT amount must equal total consideration",
      field,
    );
  }
}

function assertVat(netCents: number, rateBasisPoints: number, vatCents: number, field: string): void {
  const expected = expectedVatCents(netCents, rateBasisPoints);
  if (centsDrift(expected, vatCents)) {
    throw new RamisError(
      422,
      Code.MATH,
      `VAT amount does not match ${formatRate(rateBasisPoints)} of the value excluding VAT`,
      field,
    );
  }
}

function positiveCents(value: unknown, field: string): number {
  const cents = toCents(value, field);
  if (cents <= 0) throw new RamisError(422, Code.MATH, `${field} must be greater than zero`, field);
  return cents;
}

function nonNegativeCents(value: unknown, field: string): number {
  const cents = toCents(value, field);
  if (cents < 0) throw new RamisError(422, Code.MATH, `${field} must not be negative`, field);
  return cents;
}

function formatRate(basisPoints: number): string {
  return (basisPoints / 100).toFixed(2);
}

function stringifyTin(value: unknown, field: string): string {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) return String(value);
  if (typeof value === "string") return value.trim();
  throw new RamisError(422, Code.TIN, `${field} must be exactly 9 numeric digits`, field);
}

function asObject(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new RamisError(422, Code.SCHEMA, `${field} must be an object`, field);
  }
  return value as Record<string, unknown>;
}

function required(record: Record<string, unknown>, key: string, field: string): unknown {
  if (record[key] === undefined || record[key] === null) {
    throw new RamisError(422, Code.SCHEMA, `${field} is required`, field);
  }
  return record[key];
}

function requireText(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new RamisError(422, Code.SCHEMA, `${field} is required`, field);
  }
  return value.trim();
}

function optionalText(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new RamisError(422, Code.SCHEMA, `${field} must be a string`, field);
  const text = value.trim();
  return text === "" ? null : text;
}
