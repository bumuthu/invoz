import { NextResponse, type NextRequest } from "next/server";
import { adminSessionCookie, openAdminSession } from "@/lib/admin-session";

const loginPath = "/auth/login";

export async function middleware(request: NextRequest) {
  const session = await openAdminSession(request.cookies.get(adminSessionCookie)?.value);
  const path = request.nextUrl.pathname;
  const isLogin = path === loginPath;
  const isAuthApi = path === "/api/auth/login" || path === "/api/auth/logout";

  if (path.startsWith("/api/") && !isAuthApi && !session) {
    return NextResponse.json({ error: "Sign in as the platform admin." }, { status: 401 });
  }
  if (!session && !isLogin && !isAuthApi) {
    const url = request.nextUrl.clone();
    url.pathname = loginPath;
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (session && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
