import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import {
  classifyHost,
  hostnameFrom,
  organizationCookie,
  portalRootDomain,
  readOrganizationCookie,
} from "@/lib/host";
import { sessionSupabase } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const headerList = await headers();
  const hostname = hostnameFrom(headerList.get("x-portal-host") ?? headerList.get("host"));
  const portalHost = classifyHost(hostname);
  const session = await sessionSupabase();
  const {
    data: { user },
  } = await session.auth.getUser();
  const remembered = readOrganizationCookie((await cookies()).get(organizationCookie)?.value) ?? "";
  const root = portalRootDomain(hostname);
  return NextResponse.json(
    {
      hostLabel: portalHost.kind === "organization" ? `${portalHost.slug}.${root}` : hostname,
      organizationSlug: portalHost.kind === "organization" ? portalHost.slug : remembered,
      lockOrganization: portalHost.kind === "organization",
      signedInEmail: user?.email ?? "",
    },
    { headers: { "cache-control": "no-store" } },
  );
}
