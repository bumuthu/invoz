"use client";

import { createBrowserClient } from "@supabase/ssr";
import { authCookieDomain, hostnameFrom } from "@/lib/host";
import { supabasePublicEnv } from "@/lib/supabase-env";

export function browserSupabase() {
  const { url, key } = supabasePublicEnv();
  const domain = authCookieDomain(hostnameFrom(window.location.host));
  return createBrowserClient(url, key, {
    cookieOptions: domain ? { domain, secure: true, path: "/", sameSite: "lax" } : undefined,
  });
}
