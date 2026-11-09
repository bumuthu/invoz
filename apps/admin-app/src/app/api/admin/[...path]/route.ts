import { NextResponse } from "next/server";
import {
  addBranch,
  addLegalEntity,
  decideRequest,
  onboardOrganization,
  rotateSftpPassword,
  setRamisEnabled,
  updateAllowance,
  updateOrganizationName,
} from "@/lib/actions";
import { AdminError } from "@/lib/errors";
import { loadConnections, loadLeads, loadOrganization, loadOrganizations, loadOverview, loadRequests } from "@/lib/queries";
import type { OnboardInput, Range } from "@/lib/types";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, context: Context) {
  const { path } = await context.params;
  try {
    const body = await readAdmin(path, new URL(request.url).searchParams.get("range"));
    if (!body) return NextResponse.json({ error: "Not found." }, { status: 404, headers: noStore });
    return json(body);
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request, context: Context) {
  const { path } = await context.params;
  const body = await request.json().catch(() => null);
  try {
    const result = await writeAdmin(path.join("/"), body);
    if (!result) return NextResponse.json({ error: "Not found." }, { status: 404, headers: noStore });
    return json(result);
  } catch (error) {
    return fail(error);
  }
}

const noStore = { "cache-control": "no-store" };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: noStore });
}

function fail(error: unknown) {
  const message = error instanceof Error ? error.message : "The request could not be completed.";
  const status = error instanceof AdminError ? error.status : 500;
  return NextResponse.json({ error: message }, { status, headers: noStore });
}

async function readAdmin(path: string[], rangeValue: string | null) {
  const range = rangeOf(rangeValue);
  const key = path.join("/");
  if (key === "session") return { ok: true };
  if (key === "overview") return loadOverview(range);
  if (key === "organizations") return loadOrganizations();
  if (key === "connections") return loadConnections();
  if (key === "requests") return loadRequests();
  if (key === "leads") return loadLeads();
  if (path[0] === "organizations" && path[1] && path.length === 2) {
    return loadOrganization(decodeURIComponent(path[1]), range);
  }
  return null;
}

async function writeAdmin(key: string, body: unknown) {
  if (!body || typeof body !== "object") return { ok: false as const, error: "The request was empty." };
  const record = body as Record<string, unknown>;
  if (key === "organizations") return onboardOrganization(record as OnboardInput);
  if (key === "organization-name") return updateOrganizationName(stringField(record, "id"), stringField(record, "name"));
  if (key === "allowance") return updateAllowance(stringField(record, "id"), Number(record.allowance));
  if (key === "legal-entities") {
    return addLegalEntity({
      organizationId: stringField(record, "organizationId"),
      name: stringField(record, "name"),
      tin: stringField(record, "tin"),
      vatNumber: stringField(record, "vatNumber"),
    });
  }
  if (key === "branches") {
    return addBranch({
      legalEntityId: stringField(record, "legalEntityId"),
      code: stringField(record, "code"),
      name: stringField(record, "name"),
    });
  }
  if (key === "ramis") return setRamisEnabled(stringField(record, "legalEntityId"), record.enabled === true);
  if (key === "requests") {
    const decision = record.decision === "approve" || record.decision === "reject" ? record.decision : null;
    if (!decision) return { ok: false as const, error: "Choose approve or reject." };
    return decideRequest(stringField(record, "requestId"), decision);
  }
  if (key === "sftp-password") return rotateSftpPassword(stringField(record, "organizationId"));
  return null;
}

function stringField(record: Record<string, unknown>, key: string) {
  return typeof record[key] === "string" ? record[key] : "";
}

function rangeOf(value: string | null): Range {
  return value === "all" ? "all" : "month";
}
