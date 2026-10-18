import { createHash } from "node:crypto";
import { Code, RamisError } from "./errors";

export function toCents(value: unknown, field: string, code = Code.MATH): number {
  let text: string;
  if (typeof value === "string") {
    text = value.trim();
    if (!/^-?\d+(\.\d+)?$/.test(text)) {
      throw new RamisError(422, code, `${field} must be numeric`, field);
    }
  } else if (typeof value === "number" && Number.isFinite(value)) {
    text = value.toFixed(2);
  } else {
    throw new RamisError(422, code, `${field} must be numeric`, field);
  }

  const negative = text.startsWith("-");
  const unsigned = negative ? text.slice(1) : text;
  const [whole, fraction = ""] = unsigned.split(".");
  const digits = `${fraction}000`.slice(0, 3);
  let cents = Number(whole) * 100 + Number(digits.slice(0, 2));
  if (digits[2]! >= "5") cents += 1;
  if (!Number.isSafeInteger(cents)) {
    throw new RamisError(422, code, `${field} is out of range`, field);
  }
  return negative ? -cents : cents;
}

export function fromCents(cents: number): number {
  return Number((cents / 100).toFixed(2));
}

export function expectedVatCents(netCents: number, rateBasisPoints: number): number {
  return Math.round((netCents * rateBasisPoints) / 10_000);
}

export function centsDrift(left: number, right: number): boolean {
  return Math.abs(left - right) > 1;
}

export function canonicalHash(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
