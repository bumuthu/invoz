import type {
  loadAudit,
  loadBranches,
  loadErp,
  loadExceptions,
  loadIngestion,
  loadInvoice,
  loadMapping,
  loadOverview,
  loadScheduleDocuments,
  loadSchedulePurchases,
  loadShell,
  loadStatement,
  loadSubscription,
  loadUsers,
} from "@/lib/portal";
import type { PortalRole } from "@invoz/common";

type ActionResult = { ok: true; message: string } | { ok: false; error: string };
type InviteResult = { ok: true; message: string; inviteUrl?: string } | { ok: false; error: string };
type DocumentCorrection = {
  buyerName: string;
  buyerTin: string;
  invoiceDate: string;
  supplyDate: string;
  net: string;
  vat: string;
  total: string;
  reason: string;
  originalSerial: string;
  originalDate: string;
};

type Result<T extends (...args: never[]) => Promise<unknown>> = Awaited<ReturnType<T>>;

const reloadEvent = "portal:reload";

export function reloadPortal() {
  window.dispatchEvent(new Event(reloadEvent));
}

export function onPortalReload(listener: () => void) {
  window.addEventListener(reloadEvent, listener);
  return () => window.removeEventListener(reloadEvent, listener);
}

async function read<T>(response: Response): Promise<T> {
  if (response.redirected) {
    window.location.assign(response.url);
    throw new Error("Sign in required.");
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : "The request could not be completed.";
    throw new Error(message);
  }
  return body as T;
}

function withSearch(path: string, search: string) {
  if (!search) return path;
  return `${path}${search.startsWith("?") ? search : `?${search}`}`;
}

async function getJson<T>(path: string, search = ""): Promise<T> {
  const response = await fetch(withSearch(`/api/portal/${path}`, search), { credentials: "same-origin" });
  return read<T>(response);
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`/api/portal/${path}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return read<T>(response);
}

export function fetchShell(search: string) {
  return getJson<Result<typeof loadShell>>("shell", search);
}

export function fetchOverview(search: string) {
  return getJson<Result<typeof loadOverview>>("overview", search);
}

export function fetchUsers(search: string) {
  return getJson<Result<typeof loadUsers>>("users", search);
}

export function fetchExceptions(search: string) {
  return getJson<Result<typeof loadExceptions>>("exceptions", search);
}

export function fetchErp(search: string) {
  return getJson<Result<typeof loadErp>>("erp", search);
}

export function fetchMapping(search: string) {
  return getJson<Result<typeof loadMapping>>("mapping", search);
}

export function fetchBranches(search: string) {
  return getJson<Result<typeof loadBranches>>("branches", search);
}

export function fetchAudit(search: string) {
  return getJson<Result<typeof loadAudit>>("audit", search);
}

export function fetchStatement(search: string) {
  return getJson<Result<typeof loadStatement>>("statement", search);
}

export function fetchIngestion(search: string) {
  return getJson<Result<typeof loadIngestion>>("ingestion", search);
}

export function fetchSubscription(search: string) {
  return getJson<Result<typeof loadSubscription>>("subscription", search);
}

export function fetchSchedulePurchases(search: string) {
  return getJson<Result<typeof loadSchedulePurchases>>("schedules/02", search);
}

export function fetchScheduleDocuments(schedule: "01" | "04" | "07", search: string) {
  return getJson<Result<typeof loadScheduleDocuments>>(`schedules/${schedule}`, search);
}

export function fetchInvoice(id: string, search: string) {
  return getJson<Result<typeof loadInvoice> & { qr: string | null }>(
    `invoices/${encodeURIComponent(id)}`,
    search,
  );
}

export function approveInbound(organizationId: string, ids: string[]) {
  return postJson<ActionResult>("purchases/approve", { organizationId, ids });
}

export function connectErp(organizationId: string, entityId: string, erpCode: string) {
  return postJson<ActionResult>("erp", { organizationId, entityId, erpCode });
}

export function inviteMember(organizationId: string, email: string, role: PortalRole) {
  return postJson<InviteResult>("members", { organizationId, email, role });
}

export function correctAndResubmit(
  organizationId: string,
  source: "invoice" | "adjustment",
  sourceId: string,
  correction: DocumentCorrection,
) {
  return postJson<ActionResult>("documents/resubmit", { organizationId, source, sourceId, correction });
}

export type LoginContext = {
  hostLabel: string;
  organizationSlug: string;
  lockOrganization: boolean;
  signedInEmail: string;
};

export async function fetchLoginContext(): Promise<LoginContext> {
  const response = await fetch("/api/auth/context", { credentials: "same-origin" });
  return read<LoginContext>(response);
}

export async function openOrganization(slug: string) {
  const response = await fetch("/api/auth/organization", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ slug }),
  });
  return read<{ ok: true; href: string } | { ok: false; error: string }>(response);
}

export async function clearOrganization() {
  const response = await fetch("/api/auth/organization", { method: "DELETE", credentials: "same-origin" });
  if (!response.ok && !response.redirected) {
    throw new Error("The organization could not be cleared.");
  }
}
