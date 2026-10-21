import { NextResponse } from "next/server";
import { mailConfigured, sendDemoMail } from "@/lib/demo-mail";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Payload = {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  company?: unknown;
  erp?: unknown;
  note?: unknown;
  website?: unknown;
};

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  let body: Payload;
  try {
    body = (await request.json()) as Payload;
  } catch {
    return NextResponse.json({ error: "Send the form as JSON." }, { status: 400 });
  }

  if (text(body.website, 200)) {
    return NextResponse.json({ ok: true, emailed: true });
  }

  const name = text(body.name, 120);
  const email = text(body.email, 200);
  const phone = text(body.phone, 40);
  const company = text(body.company, 160);
  const erp = text(body.erp, 160);
  const note = text(body.note, 2000);

  if (name.length < 1 || company.length < 1 || erp.length < 1 || phone.length < 7 || !emailPattern.test(email)) {
    return NextResponse.json({ error: "Name, work email, phone, company, and ERP are required." }, { status: 400 });
  }

  const { error } = await supabase().from("demo_requests").insert({
    name,
    email,
    phone,
    company,
    erp,
    note: note || null,
  });

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "The request could not be saved." }, { status: 500 });
  }

  if (!mailConfigured()) {
    return NextResponse.json(
      { error: "The request was saved, but email is not configured." },
      { status: 502 },
    );
  }

  try {
    await sendDemoMail({ name, email, phone, company, erp, note });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "The request was saved, but the email could not be sent." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, emailed: true });
}
