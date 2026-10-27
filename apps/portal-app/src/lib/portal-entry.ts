"use server";

import { cookies, headers } from "next/headers";
import { isOrganizationSlug } from "@invoz/common";
import { prisma } from "@invoz/database";
import {
  authCookieDomain,
  classifyHost,
  hostnameFrom,
  organizationCookie,
  organizationOrigin,
  requireOrganizationHost,
} from "@/lib/host";
import { sessionSupabase } from "@/lib/session";

export async function openOrganization(
  slugInput: string,
): Promise<{ ok: true; href: string } | { ok: false; error: string }> {
  const slug = slugInput.trim().toLowerCase();
  if (!isOrganizationSlug(slug)) {
    return { ok: false, error: "Enter the organization slug, such as acme." };
  }

  const session = await sessionSupabase();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return { ok: false, error: "Sign in before choosing an organization." };

  const organization = await prisma.organization.findUnique({ where: { slug } });
  if (!organization) return { ok: false, error: "No organization uses that slug." };
  const membership = await prisma.membership.findFirst({
    where: { user_id: user.id, organization_id: organization.id },
  });
  if (!membership) return { ok: false, error: "This account is not a member of that organization." };

  const headerList = await headers();
  const hostname = hostnameFrom(headerList.get("x-portal-host") ?? headerList.get("host"));
  const portalHost = classifyHost(hostname);
  if (portalHost.kind === "organization") {
    if (portalHost.slug !== slug) {
      return { ok: false, error: "This address belongs to a different organization." };
    }
    return { ok: true, href: "/" };
  }

  if (requireOrganizationHost()) {
    return { ok: true, href: `${organizationOrigin(slug)}/` };
  }

  const domain = authCookieDomain(hostname);
  (await cookies()).set(organizationCookie, slug, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(domain ? { domain } : {}),
  });
  return { ok: true, href: "/" };
}

export async function clearOrganization() {
  const headerList = await headers();
  const hostname = hostnameFrom(headerList.get("x-portal-host") ?? headerList.get("host"));
  const domain = authCookieDomain(hostname);
  (await cookies()).set(organizationCookie, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
    ...(domain ? { domain } : {}),
  });
}
