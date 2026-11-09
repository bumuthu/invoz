import { NextResponse } from "next/server";
import { adminSessionCookie } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  response.cookies.set(adminSessionCookie, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
