import { NextResponse } from "next/server";
import QRCode from "qrcode";
import type { PortalRole } from "@invoz/common";
import { portalRoles } from "@invoz/common";
import {
  approveInbound,
  correctAndResubmit,
  inviteMember,
  requestErpChange,
  requestPoll,
  requestSftp,
  type DocumentCorrection,
} from "@/lib/actions";
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

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ path: string[] }> };

export async function GET(_request: Request, context: Context) {
  const { path } = await context.params;
  try {
    const body = await readPortal(path);
    if (!body) return NextResponse.json({ error: "Not found." }, { status: 404, headers: noStore });
    return json(body);
  } catch (error) {
    rethrowNavigation(error);
    const message = error instanceof Error ? error.message : "The portal could not be loaded.";
    return NextResponse.json({ error: message }, { status: 500, headers: noStore });
  }
}

export async function POST(request: Request, context: Context) {
  const { path } = await context.params;
  const key = path.join("/");
  const body = await request.json().catch(() => null);
  try {
    const result = await writePortal(key, body);
    if (!result) return NextResponse.json({ error: "Not found." }, { status: 404, headers: noStore });
    return json(result);
  } catch (error) {
    rethrowNavigation(error);
    const message = error instanceof Error ? error.message : "The request could not be completed.";
    return NextResponse.json({ error: message }, { status: 500, headers: noStore });
  }
}

const noStore = { "cache-control": "no-store" };

function json(body: unknown, status = 200) {
  return new NextResponse(
    JSON.stringify(body, (_key, value) => (typeof value === "bigint" ? Number(value) : value)),
    { status, headers: { "content-type": "application/json", ...noStore } },
  );
}

async function readPortal(path: string[]) {
  const key = path.join("/");
  if (key === "shell") return loadShell();
  if (key === "overview") return loadOverview();
  if (key === "users") return loadUsers();
  if (key === "exceptions") return loadExceptions();
  if (key === "erp") return loadErp();
  if (key === "mapping") return loadMapping();
  if (key === "branches") return loadBranches();
  if (key === "audit") return loadAudit();
  if (key === "statement") return loadStatement();
  if (key === "ingestion") return loadIngestion();
  if (key === "subscription") return loadSubscription();
  if (key === "schedules/02") return loadSchedulePurchases();
  if (key === "schedules/01" || key === "schedules/04" || key === "schedules/07") {
    return loadScheduleDocuments(key.slice("schedules/".length) as "01" | "04" | "07");
  }
  if (path[0] === "invoices" && path[1] && path.length === 2) {
    const portal = await loadInvoice(decodeURIComponent(path[1]));
    const invoice = portal.invoice;
    const qr = invoice?.token
      ? await QRCode.toString(`${invoice.serial}|${invoice.token}`, { type: "svg", margin: 1, width: 148 })
      : null;
    return { ...portal, qr };
  }
  return null;
}

async function writePortal(key: string, body: unknown) {
  if (!body || typeof body !== "object") return { ok: false as const, error: "The request was empty." };
  const record = body as Record<string, unknown>;
  if (key === "purchases/approve") {
    if (typeof record.organizationId !== "string" || !Array.isArray(record.ids)) {
      return { ok: false as const, error: "Purchase not found." };
    }
    const ids = record.ids.filter((id): id is string => typeof id === "string");
    return approveInbound(record.organizationId, ids);
  }
  if (key === "erp") {
    if (typeof record.organizationId !== "string") {
      return { ok: false as const, error: "Organization not found." };
    }
    const legalEntityId = record.legalEntityId === null || typeof record.legalEntityId === "string" ? record.legalEntityId : undefined;
    if ((record.action === "enable" || record.action === "disable") && typeof record.connectionId === "string") {
      return requestErpChange(record.organizationId, record.connectionId, record.action);
    }
    if (record.action === "sftp" && typeof record.erpCode === "string" && legalEntityId !== undefined) {
      return requestSftp(record.organizationId, record.erpCode, legalEntityId);
    }
    if (
      record.action === "poll" &&
      typeof record.erpCode === "string" &&
      typeof record.label === "string" &&
      typeof record.endpointUrl === "string" &&
      typeof record.apiKey === "string" &&
      (record.lastInvoiceId === null || typeof record.lastInvoiceId === "string") &&
      (record.connectionId === null || typeof record.connectionId === "string") &&
      legalEntityId !== undefined
    ) {
      return requestPoll({
        organizationId: record.organizationId,
        erpCode: record.erpCode,
        label: record.label,
        endpointUrl: record.endpointUrl,
        apiKey: record.apiKey,
        lastInvoiceId: record.lastInvoiceId,
        legalEntityId,
        connectionId: record.connectionId,
      });
    }
    return { ok: false as const, error: "Integration request was not understood." };
  }
  if (key === "members") {
    if (typeof record.organizationId !== "string" || typeof record.email !== "string" || !isRole(record.role)) {
      return { ok: false as const, error: "Choose a role other than owner." };
    }
    return inviteMember(record.organizationId, record.email, record.role);
  }
  if (key === "documents/resubmit") {
    if (
      typeof record.organizationId !== "string" ||
      (record.source !== "invoice" && record.source !== "adjustment") ||
      typeof record.sourceId !== "string" ||
      !isCorrection(record.correction)
    ) {
      return { ok: false as const, error: "Document not found." };
    }
    return correctAndResubmit(record.organizationId, record.source, record.sourceId, record.correction);
  }
  return null;
}

function isRole(value: unknown): value is PortalRole {
  return typeof value === "string" && (portalRoles as readonly string[]).includes(value);
}

function isCorrection(value: unknown): value is DocumentCorrection {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.buyerName === "string" &&
    typeof row.buyerTin === "string" &&
    typeof row.invoiceDate === "string" &&
    typeof row.supplyDate === "string" &&
    typeof row.net === "string" &&
    typeof row.vat === "string" &&
    typeof row.total === "string" &&
    typeof row.reason === "string" &&
    typeof row.originalSerial === "string" &&
    typeof row.originalDate === "string"
  );
}

function rethrowNavigation(error: unknown): void {
  if (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof error.digest === "string" &&
    (error.digest.startsWith("NEXT_REDIRECT") || error.digest.startsWith("NEXT_HTTP_ERROR_FALLBACK"))
  ) {
    throw error;
  }
}
