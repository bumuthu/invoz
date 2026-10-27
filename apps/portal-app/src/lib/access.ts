import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { portalRoles, type PortalRole } from "@invoz/common";
import { membershipRow, organizationRow, prisma } from "@invoz/database";
import { readFilters } from "@/lib/filters";
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
  const host = (await headers()).get("host")?.split(":")[0] ?? "";
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  if (!root || host === "localhost" || host.endsWith(".localhost")) {
    return null;
  }
  const suffix = `.${root}`;
  if (!host.endsWith(suffix) || host === root) {
    return null;
  }
  return host.slice(0, -suffix.length);
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
  const requestedOrg = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("org");
  const slug = await requestedSlug();
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
    .filter((item) => (slug ? item.slug === slug : true));
  const hostPinned = Boolean(slug);
  const organization =
    (!hostPinned && organizations.find((item) => String(item.id) === requestedOrg)) || organizations[0];
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
    hostPinned,
    filters,
  };
});
