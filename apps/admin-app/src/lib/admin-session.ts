export const adminSessionCookie = "admin-session";
const maxAgeSeconds = 60 * 60 * 24 * 7;

type SessionPayload = { email: string; exp: number };

function secret(): string {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");
  return value;
}

function encode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decode(value: string): Uint8Array {
  const pad = (4 - (value.length % 4)) % 4;
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat(pad);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return encode(new Uint8Array(signature));
}

function same(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export async function issueAdminSession(email: string): Promise<string> {
  const payload = encode(new TextEncoder().encode(JSON.stringify({ email, exp: Date.now() + maxAgeSeconds * 1000 } satisfies SessionPayload)));
  return `${payload}.${await sign(payload)}`;
}

export async function openAdminSession(token: string | undefined): Promise<{ email: string } | null> {
  if (!token) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;
  const expected = await sign(payload);
  if (!same(signature, expected)) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(decode(payload))) as SessionPayload;
    if (!parsed.email || typeof parsed.exp !== "number" || parsed.exp < Date.now()) return null;
    return { email: parsed.email };
  } catch {
    return null;
  }
}

export function adminSessionOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
