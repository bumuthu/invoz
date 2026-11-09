import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@invoz/database";
import { adminSessionCookie, openAdminSession } from "@/lib/admin-session";
import { AdminError } from "@/lib/errors";

export type Admin = { userId: string; email: string };

export async function requireAdmin(): Promise<Admin> {
  const cookieStore = await cookies();
  const session = await openAdminSession(cookieStore.get(adminSessionCookie)?.value);
  if (!session) throw new AdminError("Sign in as the platform admin.", 401);
  const admin = await prisma.adminUser.findUnique({ where: { email: session.email }, select: { id: true, email: true } });
  if (!admin) throw new AdminError("Sign in as the platform admin.", 401);
  return { userId: String(admin.id), email: admin.email };
}
