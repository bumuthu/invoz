import { NextResponse } from "next/server";
import { verifySecret } from "@invoz/common/secret";
import { prisma } from "@invoz/database";
import { adminSessionCookie, adminSessionOptions, issueAdminSession } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: unknown; password?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const admin = email ? await prisma.adminUser.findUnique({ where: { email } }) : null;
  if (!admin || !verifySecret(password, admin.password_hash)) {
    return NextResponse.json({ error: "Invalid login credentials." }, { status: 401, headers: { "cache-control": "no-store" } });
  }
  const response = NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  response.cookies.set(adminSessionCookie, await issueAdminSession(admin.email), adminSessionOptions());
  return response;
}
