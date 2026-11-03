"use server";

import QRCode from "qrcode";
import {
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
import { withPortalSearch } from "@/lib/portal-search";

export async function fetchShell(search: string) {
  return withPortalSearch(search, () => loadShell());
}

export async function fetchOverview(search: string) {
  return withPortalSearch(search, () => loadOverview());
}

export async function fetchUsers(search: string) {
  return withPortalSearch(search, () => loadUsers());
}

export async function fetchExceptions(search: string) {
  return withPortalSearch(search, () => loadExceptions());
}

export async function fetchErp(search: string) {
  return withPortalSearch(search, () => loadErp());
}

export async function fetchMapping(search: string) {
  return withPortalSearch(search, () => loadMapping());
}

export async function fetchBranches(search: string) {
  return withPortalSearch(search, () => loadBranches());
}

export async function fetchAudit(search: string) {
  return withPortalSearch(search, () => loadAudit());
}

export async function fetchStatement(search: string) {
  return withPortalSearch(search, () => loadStatement());
}

export async function fetchIngestion(search: string) {
  return withPortalSearch(search, () => loadIngestion());
}

export async function fetchSubscription(search: string) {
  return withPortalSearch(search, () => loadSubscription());
}

export async function fetchSchedulePurchases(search: string) {
  return withPortalSearch(search, () => loadSchedulePurchases());
}

export async function fetchScheduleDocuments(schedule: "01" | "04" | "07", search: string) {
  return withPortalSearch(search, () => loadScheduleDocuments(schedule));
}

export async function fetchInvoice(id: string, search: string) {
  return withPortalSearch(search, async () => {
    const portal = await loadInvoice(id);
    const invoice = portal.invoice;
    const qr = invoice?.token
      ? await QRCode.toString(`${invoice.serial}|${invoice.token}`, { type: "svg", margin: 1, width: 148 })
      : null;
    return { ...portal, qr };
  });
}
