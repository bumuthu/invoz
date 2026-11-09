import { ramisStatuses, type RamisStatusName, type StatusCounts } from "@/lib/types";

export function emptyCounts(): StatusCounts {
  return { draft: 0, validated: 0, queued: 0, cleared: 0, rejected: 0, skipped_non_vat: 0, total: 0 };
}

export function addCount(counts: StatusCounts, status: string, amount: number) {
  if ((ramisStatuses as readonly string[]).includes(status)) {
    counts[status as RamisStatusName] += amount;
  }
  counts.total += amount;
}

export function monthBounds(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
  };
}
