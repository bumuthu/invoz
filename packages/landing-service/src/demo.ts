import { supabase } from "./db";
import { mailConfigured, sendDemoMail } from "./mail";
import type { LandingRequest, LandingResponse } from "./types";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function field(body: Record<string, unknown>, name: string) {
  return body[name];
}

export async function bookDemo(request: LandingRequest): Promise<LandingResponse> {
  const body = request.json && typeof request.json === "object" ? (request.json as Record<string, unknown>) : {};

  if (text(field(body, "website"), 200)) {
    return { status: 200, body: { ok: true, emailed: true } };
  }

  const name = text(field(body, "name"), 120);
  const email = text(field(body, "email"), 200);
  const phone = text(field(body, "phone"), 40);
  const company = text(field(body, "company"), 160);
  const erp = text(field(body, "erp"), 160);
  const note = text(field(body, "note"), 2000);

  if (name.length < 1 || company.length < 1 || erp.length < 1 || phone.length < 7 || !emailPattern.test(email)) {
    return { status: 400, body: { error: "Name, work email, phone, company, and ERP are required." } };
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
    return { status: 500, body: { error: "The request could not be saved." } };
  }

  if (!mailConfigured()) {
    return { status: 502, body: { error: "The request was saved, but email is not configured." } };
  }

  try {
    await sendDemoMail({ name, email, phone, company, erp, note });
  } catch (mailError) {
    console.error(mailError);
    return { status: 502, body: { error: "The request was saved, but the email could not be sent." } };
  }

  return { status: 200, body: { ok: true, emailed: true } };
}
