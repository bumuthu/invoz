import type { InvoiceStatus, PortalFilters } from "@/lib/types";

const statuses = ["Cleared", "Submitting", "Rejected", "Skipped"] as const;

function isSchedule(value: string | null): value is "01" | "02" | "04" {
  return value === "01" || value === "02" || value === "04";
}

export const emptyFilters: PortalFilters = {
  entityId: "all",
  branch: "all",
  period: "all",
  schedule: "all",
  status: "all",
};

export function readFilters(search: string): PortalFilters {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const status = params.get("status");
  const schedule = params.get("schedule");
  return {
    entityId: params.get("entity") || "all",
    branch: params.get("branch") || "all",
    period: /^\d{4}-\d{2}$/.test(params.get("period") ?? "") ? (params.get("period") as string) : "all",
    schedule: isSchedule(schedule) ? schedule : "all",
    status: statuses.includes(status as InvoiceStatus) ? (status as InvoiceStatus) : "all",
  };
}

export function writeFilters(
  filters: PortalFilters,
  organizationId: string,
  showOrganization: boolean,
): string {
  const params = new URLSearchParams();
  if (showOrganization) params.set("org", organizationId);
  if (filters.entityId !== "all") params.set("entity", filters.entityId);
  if (filters.branch !== "all") params.set("branch", filters.branch);
  if (filters.period !== "all") params.set("period", filters.period);
  if (filters.schedule !== "all") params.set("schedule", filters.schedule);
  if (filters.status !== "all") params.set("status", filters.status);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function monthRange(period: string): { gte: Date; lt: Date } | null {
  if (!/^\d{4}-\d{2}$/.test(period)) return null;
  const [year, month] = period.split("-").map(Number);
  return {
    gte: new Date(Date.UTC(year, month - 1, 1)),
    lt: new Date(Date.UTC(year, month, 1)),
  };
}

export function monthKey(value: string): string {
  return value.slice(0, 7);
}

export function periodLabel(period: string): string {
  const [year, month] = period.split("-").map(Number);
  const names = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${names[month - 1]} ${year}`;
}
