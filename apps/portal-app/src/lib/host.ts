import { isOrganizationSlug } from "@invoz/common";

export const organizationCookie = "portal-organization";

const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);

const portalDomain = "invoz.lk";
const productionRoot = `app.${portalDomain}`;
const stagingRoot = `app-stag.${portalDomain}`;

/** `app.invoz.lk` in production. `app-stag.invoz.lk` when the request is already on staging. */
export function portalRootDomain(hostname = ""): string {
  const host = hostname.toLowerCase();
  if (host === stagingRoot || host.endsWith(`.${stagingRoot}`)) return stagingRoot;
  return productionRoot;
}

/**
 * When true, the portal root only signs in and then sends the browser to `{slug}.{root}`.
 * When false, the root URL (including localhost) can open the portal after that same login.
 */
export function requireOrganizationHost(): boolean {
  const value = process.env.PORTAL_REQUIRE_ORG_HOST?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

export function hostnameFrom(value: string | null | undefined): string {
  const first = value?.split(",")[0]?.trim().toLowerCase() ?? "";
  if (!first) return "";
  if (first.startsWith("[")) {
    const end = first.indexOf("]");
    return end === -1 ? first : first.slice(1, end);
  }
  return first.replace(/:\d+$/, "");
}

export type PortalHost = { kind: "default" } | { kind: "organization"; slug: string };

export function isLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return localHosts.has(host) || host.endsWith(".localhost");
}

/** `app.invoz.lk` in production and `app-stag.invoz.lk` on a staging host. */
export function defaultPortalHost(hostname = ""): string {
  return portalRootDomain(hostname);
}

export function classifyHost(hostname: string): PortalHost {
  const host = hostname.toLowerCase();
  const root = portalRootDomain(host);
  if (!host || isLocalHost(host) || host === root) {
    return { kind: "default" };
  }
  const suffix = `.${root}`;
  if (host.endsWith(suffix)) {
    const slug = host.slice(0, -suffix.length);
    if (!slug.includes(".") && isOrganizationSlug(slug)) {
      return { kind: "organization", slug };
    }
  }
  return { kind: "default" };
}

export function readOrganizationCookie(value: string | undefined): string | null {
  if (!value || !isOrganizationSlug(value)) return null;
  return value;
}

export function organizationOrigin(slug: string, hostname = ""): string {
  return `https://${slug}.${portalRootDomain(hostname)}`;
}

/** Share the session across the portal root and `{slug}.{root}`. Localhost stays host-only. */
export function authCookieDomain(hostname: string): string | undefined {
  const root = portalRootDomain(hostname);
  const host = hostname.toLowerCase();
  if (isLocalHost(host)) return undefined;
  if (host === root || host.endsWith(`.${root}`)) return `.${root}`;
  return undefined;
}
