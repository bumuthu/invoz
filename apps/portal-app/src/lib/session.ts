import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { authCookieDomain, hostnameFrom } from "@/lib/host";
import { supabasePublicEnv } from "@/lib/supabase-env";

export async function sessionSupabase() {
  const cookieStore = await cookies();
  const headerList = await headers();
  const domain = authCookieDomain(hostnameFrom(headerList.get("x-portal-host") ?? headerList.get("host")));
  const { url, key } = supabasePublicEnv();

  return createServerClient(url, key, {
    cookieOptions: domain ? { domain, secure: true, path: "/", sameSite: "lax" } : undefined,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot always write cookies. Middleware refreshes the session.
        }
      },
    },
  });
}
