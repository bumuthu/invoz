import type { PortalFilters } from "@/lib/types";

export const emptyFilters: PortalFilters = {
  entityId: "all",
  branch: "all",
  period: "all",
};

export function readFilters(search: string): PortalFilters {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return {
    entityId: params.get("entity") || "all",
    branch: params.get("branch") || "all",
    period: /^\d{4}-\d{2}$/.test(params.get("period") ?? "") ? (params.get("period") as string) : "all",
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
