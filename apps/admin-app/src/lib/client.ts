"use client";

import type { ActionResult, ConnectionRow, LeadView, OrganizationDetail, OrganizationSummary, Overview, Range, RequestView } from "@/lib/types";

export async function getJson<T>(path: string, range?: Range): Promise<T> {
  const query = range ? `?range=${range}` : "";
  const response = await fetch(`/api/admin/${path}${query}`, { cache: "no-store" });
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  if (response.status === 401) {
    window.location.assign("/auth/login");
    throw new Error("Sign in as the platform admin.");
  }
  if (!response.ok) throw new Error(body?.error ?? "The page could not be loaded.");
  return body as T;
}

export async function postJson(path: string, payload: unknown): Promise<ActionResult> {
  const response = await fetch(`/api/admin/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await response.json().catch(() => null)) as ActionResult | { error?: string } | null;
  if (response.status === 401) {
    window.location.assign("/auth/login");
    return { ok: false, error: "Sign in as the platform admin." };
  }
  if (!response.ok) return { ok: false, error: body && "error" in body ? body.error : "The request could not be completed." };
  return (body as ActionResult) ?? { ok: false, error: "The request could not be completed." };
}

export const fetchOverview = (range: Range) => getJson<Overview>("overview", range);
export const fetchOrganizations = () => getJson<OrganizationSummary[]>("organizations");
export async function fetchOrganization(id: string, range: Range) {
  const organization = await getJson<OrganizationDetail | null>(`organizations/${id}`, range);
  if (!organization) throw new Error("Organization not found.");
  return organization;
}
export const fetchConnections = () => getJson<ConnectionRow[]>("connections");
export const fetchRequests = () => getJson<{ sftp: RequestView[]; poll: RequestView[] }>("requests");
export const fetchLeads = () => getJson<LeadView[]>("leads");
