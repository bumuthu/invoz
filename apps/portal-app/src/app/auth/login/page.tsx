import { cookies, headers } from "next/headers";
import LoginForm from "./LoginForm";
import {
  classifyHost,
  hostnameFrom,
  organizationCookie,
  readOrganizationCookie,
} from "@/lib/host";
import { sessionSupabase } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const headerList = await headers();
  const hostname = hostnameFrom(headerList.get("x-portal-host") ?? headerList.get("host"));
  const portalHost = classifyHost(hostname);
  const session = await sessionSupabase();
  const {
    data: { user },
  } = await session.auth.getUser();
  const remembered = readOrganizationCookie((await cookies()).get(organizationCookie)?.value) ?? "";
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? hostname;

  return (
    <LoginForm
      hostLabel={portalHost.kind === "organization" ? `${portalHost.slug}.${root}` : hostname}
      organizationSlug={portalHost.kind === "organization" ? portalHost.slug : remembered}
      lockOrganization={portalHost.kind === "organization"}
      signedInEmail={user?.email ?? ""}
      error={params.error}
    />
  );
}
