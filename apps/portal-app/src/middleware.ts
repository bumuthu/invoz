import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  authCookieDomain,
  classifyHost,
  defaultPortalHost,
  hostnameFrom,
  organizationCookie,
  readOrganizationCookie,
  requireOrganizationHost,
} from "@/lib/host";
import { supabasePublicEnv } from "@/lib/supabase-env";

const loginPath = "/auth/login";

export async function middleware(request: NextRequest) {
  const hostname = hostnameFrom(request.headers.get("x-forwarded-host") ?? request.headers.get("host"));
  request.headers.set("x-portal-host", hostname);
  request.headers.set("x-portal-search", request.nextUrl.search);

  const portalHost = classifyHost(hostname);
  const canonical = defaultPortalHost();
  if (requireOrganizationHost() && portalHost.kind === "default" && canonical && hostname !== canonical) {
    return NextResponse.redirect(new URL(loginPath, `https://${canonical}`));
  }

  const domain = authCookieDomain(hostname);
  let response = NextResponse.next({ request });
  const { url, key } = supabasePublicEnv();
  const supabase = createServerClient(url, key, {
    cookieOptions: domain ? { domain, secure: true, path: "/", sameSite: "lax" } : undefined,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const user = data.user;
  const path = request.nextUrl.pathname;
  const isLogin = path === loginPath;
  const hasError = Boolean(request.nextUrl.searchParams.get("error"));
  const orgSlug = readOrganizationCookie(request.cookies.get(organizationCookie)?.value);

  if (portalHost.kind === "default") {
    if (requireOrganizationHost()) {
      if (!isLogin) return redirectWithSession(request, response, loginPath);
      return response;
    }
    if ((!user || !orgSlug) && !isLogin) return redirectWithSession(request, response, loginPath);
    if (user && orgSlug && isLogin && !hasError) return redirectWithSession(request, response, "/");
    return response;
  }

  if (!user && !isLogin) return redirectWithSession(request, response, loginPath);
  if (user && isLogin && !hasError) return redirectWithSession(request, response, "/");
  return response;
}

function redirectWithSession(request: NextRequest, sessionResponse: NextResponse, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = pathname === loginPath ? "" : url.search;
  const redirect = NextResponse.redirect(url);
  for (const cookie of sessionResponse.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
