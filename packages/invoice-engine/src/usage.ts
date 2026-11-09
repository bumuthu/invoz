import type { Prisma } from "@invoz/database";

/** First day of the clearance month in Asia/Colombo, matching the admin and portal allowance period. */
export function usagePeriod(clearedAt: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(clearedAt);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${year}-${month}-01`;
}

export async function recordClearedInvoice(
  tx: Prisma.TransactionClient,
  organizationId: bigint,
  clearedAt: Date,
): Promise<void> {
  const period = usagePeriod(clearedAt);
  await tx.$executeRaw`
    insert into invoice_usage (organization_id, period, cleared_count)
    values (${organizationId}, ${period}::date, 1)
    on conflict (organization_id, period)
    do update set cleared_count = invoice_usage.cleared_count + 1
  `;
}
