const defaultOrigins = [
  "https://invoz.lk",
  "https://www.invoz.lk",
  "http://localhost:3002",
  "http://127.0.0.1:3002",
];

export function allowOrigin(origin: string | undefined): string | undefined {
  if (!origin) return undefined;
  const configured = process.env.LANDING_ALLOWED_ORIGINS?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const list = configured?.length ? configured : defaultOrigins;
  if (list.includes(origin)) return origin;
  if (configured?.length) return undefined;
  try {
    const url = new URL(origin);
    if (url.protocol === "https:" && url.hostname.endsWith(".amplifyapp.com")) return origin;
  } catch {
    return undefined;
  }
  return undefined;
}

export function corsHeaders(origin: string | undefined): Record<string, string> {
  const allowed = allowOrigin(origin);
  return {
    ...(allowed ? { "access-control-allow-origin": allowed } : {}),
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    vary: "origin",
  };
}
