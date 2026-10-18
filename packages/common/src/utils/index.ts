import type { PortalRole } from "../entities";

export const reservedOrganizationSlugs = ["www", "admin", "app", "api"] as const;

const organizationSlugPattern = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
const tinPattern = /^[0-9]{9}$/;
const branchCodePattern = /^[A-Za-z0-9]{1,15}$/;
const payloadHashPattern = /^[a-f0-9]{64}$/;
const gazettePeriodPattern = /^[0-9]{2}[A-Z]{3}$/;

const gazetteMonths = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
] as const;

const reservedSlugs = new Set<string>(reservedOrganizationSlugs);

export function isOrganizationSlug(value: string): boolean {
  return organizationSlugPattern.test(value) && !reservedSlugs.has(value);
}

export function isTin(value: string): boolean {
  return tinPattern.test(value);
}

export function isBranchCode(value: string): boolean {
  return branchCodePattern.test(value);
}

export function isPayloadHash(value: string): boolean {
  return payloadHashPattern.test(value);
}

export function assertOrganizationSlug(slug: string): void {
  if (!isOrganizationSlug(slug)) {
    throw new Error("slug must be a hostname label, and not www, admin, app, or api");
  }
}

export function assertTin(tin: string): void {
  if (!isTin(tin)) {
    throw new Error("tin must be 9 digits");
  }
}

export function assertBranchCode(branchCode: string): void {
  if (!isBranchCode(branchCode)) {
    throw new Error("branchCode must be 1 to 15 letters or digits");
  }
}

export function assertPositiveInt(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
}

export function gazettePeriod(on: Date): string {
  const year = String(on.getFullYear()).slice(-2);
  return `${year}${gazetteMonths[on.getMonth()]}`;
}

export function formatGazetteSerial(period: string, branchCode: string, sequence: number): string {
  if (!gazettePeriodPattern.test(period)) {
    throw new Error("period must look like 26OCT");
  }
  assertBranchCode(branchCode);
  assertPositiveInt(sequence, "sequence");
  const serial = `${period}_${branchCode}_${String(sequence).padStart(5, "0")}`;
  if (serial.length > 40) {
    throw new Error("serial number must be 40 characters or fewer");
  }
  return serial;
}

export function portalRoleLabel(role: PortalRole): string {
  switch (role) {
    case "owner":
      return "Owner";
    case "admin":
      return "Admin";
    case "manager":
      return "Manager";
    case "staff":
      return "Staff";
    case "viewer":
      return "Viewer";
  }
}
