"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabasePublicEnv } from "@/lib/supabase-env";

export function browserSupabase() {
  const { url, key } = supabasePublicEnv();
  return createBrowserClient(url, key);
}
