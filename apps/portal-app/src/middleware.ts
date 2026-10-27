import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabasePublicEnv } from "@/lib/supabase-env";

const loginPath = "/auth/login";

export async function middleware(request: NextRequest) {
  request.headers.set("x-portal-search", request.nextUrl.search);
  let response = NextResponse.next({ request });
  const { url, key } = supabasePublicEnv();
  const supabase = createServerClient(url, key, {
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

  if (!user && !isLogin) {
    return redirectWithSession(request, response, loginPath);
  }

  if (user && isLogin && !request.nextUrl.searchParams.get("error")) {
    return redirectWithSession(request, response, "/");
  }

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
