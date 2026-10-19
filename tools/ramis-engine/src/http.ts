import type { IncomingMessage, ServerResponse } from "node:http";
import { Code, RamisError } from "./errors";

const BODY_LIMIT = 1_048_576;

export function header(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0];
  return value;
}

export function sendJson(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    ...headers,
  });
  res.end(JSON.stringify(body));
}

export async function readJson(req: IncomingMessage): Promise<unknown> {
  return parseJson(header(req, "content-type"), await readBody(req));
}

export function parseJson(contentType: string | undefined, raw: string): unknown {
  if (!(contentType ?? "").toLowerCase().includes("application/json")) {
    throw new RamisError(415, Code.SCHEMA, "Content-Type must be application/json", "Content-Type");
  }
  if (raw.trim() === "") throw new RamisError(400, Code.SCHEMA, "Request body is required");
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new RamisError(400, Code.SCHEMA, "Request body is not valid JSON");
  }
}

export async function readForm(req: IncomingMessage): Promise<URLSearchParams> {
  return parseForm(header(req, "content-type"), await readBody(req));
}

export function parseForm(contentType: string | undefined, raw: string): URLSearchParams {
  if (!(contentType ?? "").toLowerCase().includes("application/x-www-form-urlencoded")) {
    throw new RamisError(415, Code.SCHEMA, "Content-Type must be application/x-www-form-urlencoded", "Content-Type");
  }
  return new URLSearchParams(raw);
}

export async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    size += buffer.length;
    if (size > BODY_LIMIT) throw new RamisError(413, Code.SCHEMA, "Request body exceeds 1 MB");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}
