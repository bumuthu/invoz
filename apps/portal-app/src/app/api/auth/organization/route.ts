import { NextResponse } from "next/server";
import { clearOrganization, openOrganization } from "@/lib/portal-entry";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const slug = body && typeof body === "object" && "slug" in body && typeof body.slug === "string" ? body.slug : "";
  const result = await openOrganization(slug);
  return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
}

export async function DELETE() {
  await clearOrganization();
  return new NextResponse(null, { status: 204, headers: { "cache-control": "no-store" } });
}
