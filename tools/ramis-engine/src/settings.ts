export type Settings = {
  clientSecret: string;
  tokenTtlSeconds: number;
  rateLimit: number;
  rateWindowSeconds: number;
  maxDelaySeconds: number;
  defaultDelaySeconds: number;
  forceOutage: boolean;
  forceThrottle: boolean;
  pageSizeDefault: number;
  pageSizeMax: number;
  approvalBatchMax: number;
  host: string;
  port: number;
};

function integer(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${name} must be an integer`);
  }
  return parsed;
}

function flag(env: NodeJS.ProcessEnv, name: string): boolean {
  return ["1", "true", "yes", "on"].includes((env[name] ?? "").trim().toLowerCase());
}

export function settingsFromEnv(env: NodeJS.ProcessEnv = process.env): Settings {
  return {
    clientSecret: env.RAMIS_MOCK_CLIENT_SECRET?.trim() || "ramis-mock-secret",
    tokenTtlSeconds: integer(env, "RAMIS_MOCK_TOKEN_TTL_SECONDS", 3600),
    rateLimit: integer(env, "RAMIS_MOCK_RATE_LIMIT", 120),
    rateWindowSeconds: integer(env, "RAMIS_MOCK_RATE_WINDOW_SECONDS", 60),
    maxDelaySeconds: integer(env, "RAMIS_MOCK_MAX_DELAY_SECONDS", 120),
    defaultDelaySeconds: integer(env, "RAMIS_MOCK_DELAY_SECONDS", 0),
    forceOutage: flag(env, "RAMIS_MOCK_FORCE_OUTAGE"),
    forceThrottle: flag(env, "RAMIS_MOCK_FORCE_THROTTLE"),
    pageSizeDefault: integer(env, "RAMIS_MOCK_PAGE_SIZE_DEFAULT", 500),
    pageSizeMax: integer(env, "RAMIS_MOCK_PAGE_SIZE_MAX", 5000),
    approvalBatchMax: integer(env, "RAMIS_MOCK_APPROVAL_BATCH_MAX", 5000),
    host: env.HOST?.trim() || "127.0.0.1",
    port: integer(env, "PORT", 8090),
  };
}
