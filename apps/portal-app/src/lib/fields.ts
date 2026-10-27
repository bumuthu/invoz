export const targetFields = [
  "Buyer TIN",
  "Buyer name",
  "Invoice date",
  "Supply date",
  "Branch code",
  "Net amount",
  "VAT amount",
  "Ignore",
] as const;

export type TargetField = (typeof targetFields)[number];

export function isTargetField(value: string): value is TargetField {
  return (targetFields as readonly string[]).includes(value);
}
