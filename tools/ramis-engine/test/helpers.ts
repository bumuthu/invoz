import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { createApp, type App } from "../src/server";
import { settingsFromEnv, type Settings } from "../src/settings";

export type Session = {
  baseUrl: string;
  app: App;
};

export function testSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    ...settingsFromEnv({}),
    clientSecret: "ramis-mock-secret",
    tokenTtlSeconds: 3600,
    rateLimit: 0,
    rateWindowSeconds: 60,
    maxDelaySeconds: 120,
    defaultDelaySeconds: 0,
    forceOutage: false,
    forceThrottle: false,
    pageSizeDefault: 500,
    pageSizeMax: 5000,
    approvalBatchMax: 5000,
    host: "127.0.0.1",
    port: 0,
    ...overrides,
  };
}

export async function withServer(
  run: (session: Session) => Promise<void>,
  options: { settings?: Partial<Settings>; sleep?: (seconds: number) => Promise<void> } = {},
): Promise<void> {
  const app = createApp(testSettings(options.settings), { sleep: options.sleep });
  await new Promise<void>((resolve, reject) => {
    app.server.once("error", reject);
    app.server.listen(0, "127.0.0.1", () => {
      app.server.removeListener("error", reject);
      resolve();
    });
  });
  const address = app.server.address() as AddressInfo;
  try {
    await run({ baseUrl: `http://127.0.0.1:${address.port}`, app });
  } finally {
    await new Promise<void>((resolve, reject) => {
      app.server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

export async function login(baseUrl: string, clientId = "104829102", secret = "ramis-mock-secret"): Promise<string> {
  const response = await fetch(`${baseUrl}/oauth/v2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: secret,
    }),
  });
  const body = (await response.json()) as { access_token?: string };
  if (!response.ok || !body.access_token) {
    throw new Error(`login failed: ${response.status} ${JSON.stringify(body)}`);
  }
  return body.access_token;
}

export function jsonHeaders(token: string, tin: string, key = randomUUID()): Record<string, string> {
  return {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "x-client-tin": tin,
    "x-idempotency-key": key,
  };
}

export async function postJson(
  baseUrl: string,
  path: string,
  token: string,
  tin: string,
  body: unknown,
  extra: Record<string, string> = {},
): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { ...jsonHeaders(token, tin), ...extra },
    body: JSON.stringify(body),
  });
}

export async function readError(response: Response): Promise<{ code: string; message: string; field?: string }> {
  return (await response.json()) as { code: string; message: string; field?: string };
}
