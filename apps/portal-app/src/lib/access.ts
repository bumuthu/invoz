import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { portalRoles, type PortalRole } from "@invoz/common";
import { membershipRow, organizationRow, prisma } from "@invoz/database";
import { readFilters } from "@/lib/filters";
import {
  classifyHost,
  hostnameFrom,
  organizationCookie,
  readOrganizationCookie,
  requireOrganizationHost,
} from "@/lib/host";
import { sessionSupabase } from "@/lib/session";
import type { PortalFilters } from "@/lib/types";

export type Access = {
  userId: string;
  email: string;
  name: string;
  role: PortalRole;
  organization: ReturnType<typeof organizationRow>;
  organizations: ReturnType<typeof organizationRow>[];
  hostPinned: boolean;
  filters: PortalFilters;
};

export function permissions(role: PortalRole) {
  return {
    canApprove: role === "owner" || role === "admin" || role === "manager",
    canRequeue: role === "owner" || role === "admin" || role === "manager" || role === "staff",
    canMap: role === "owner" || role === "admin",
    canAudit: role !== "staff",
  };
}

async function requestedSlug(): Promise<string | null> {
  const headerList = await headers();
  const hostname = hostnameFrom(headerList.get("x-portal-host") ?? headerList.get("host"));
  const portalHost = classifyHost(hostname);
  if (portalHost.kind === "organization") return portalHost.slug;
  if (requireOrganizationHost()) redirect("/auth/login");
  return readOrganizationCookie((await cookies()).get(organizationCookie)?.value);
}

function asRole(role: string): PortalRole {
  if (!(portalRoles as readonly string[]).includes(role)) {
    throw new Error(`membership role ${role} is not a portal role`);
  }
  return role as PortalRole;
}

export const resolveAccess = cache(async (): Promise<Access> => {
  const session = await sessionSupabase();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) {
    redirect("/auth/login");
  }

  const search = (await headers()).get("x-portal-search") ?? "";
  const filters = readFilters(search);
  const slug = await requestedSlug();
  if (!slug) redirect("/auth/login");
  const memberships = (
    await prisma.membership.findMany({ where: { user_id: user.id } })
  ).map(membershipRow);
  if (memberships.length === 0) {
    redirect("/auth/login?error=membership");
  }

  const organizations = (
    await prisma.organization.findMany({
      where: { id: { in: memberships.map((membership) => BigInt(membership.organization_id)) } },
    })
  )
    .map(organizationRow)
    .filter((item) => item.slug === slug);
  const organization = organizations[0];
  if (!organization) {
    redirect("/auth/login?error=membership");
  }

  const membership = memberships.find(
    (item) => item.organization_id === organization.id && item.user_id === user.id,
  );
  if (!membership) {
    redirect("/auth/login?error=membership");
  }

  const metadataName = user.user_metadata?.name;
  const name = typeof metadataName === "string" && metadataName ? metadataName : (user.email ?? "").split("@")[0];

  return {
    userId: user.id,
    email: user.email ?? "",
    name: name || "Owner",
    role: asRole(membership.role),
    organization,
    organizations,
    hostPinned: true,
    filters,
  };
});
