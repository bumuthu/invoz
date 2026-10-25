import nodemailer from "nodemailer";

const inbox = "bumuthu.dilshan@gmail.com";

export type DemoMail = {
  name: string;
  email: string;
  phone: string;
  company: string;
  erp: string;
  note: string;
};

export function emailEnabled() {
  const value = (process.env.LANDING_EMAIL_ENABLED || "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

export function mailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}

export async function sendDemoMail(request: DemoMail) {
  const from = process.env.DEMO_FROM_EMAIL || process.env.SMTP_USER;
  if (!mailConfigured() || !from) {
    throw new Error("SMTP is not configured");
  }

  const port = Number(process.env.SMTP_PORT || 587);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  const lines = [
    `${request.name} from ${request.company} asked for an Invoz demo.`,
    "",
    `Name: ${request.name}`,
    `Email: ${request.email}`,
    `Phone: ${request.phone}`,
    `Company: ${request.company}`,
    `ERPs: ${request.erp}`,
    request.note ? `Other notes: ${request.note}` : "Other notes: —",
  ];

  await transport.sendMail({
    from,
    to: inbox,
    replyTo: request.email,
    subject: `Invoz demo request from ${request.company}`,
    text: lines.join("\n"),
  });
}
