import { createServer, type Server } from "node:http";
import { requireBearer, issueToken, secretsMatch } from "./auth";
import { Code, errorBody, RamisError } from "./errors";
import type { ApiCall, ApiResult } from "./gateway";
import { readBody, parseForm, parseJson, sendJson } from "./http";
import { immutableInvoice, Ledger } from "./ledger";
import { openStore } from "./open-store";
import type { Settings } from "./settings";
import type { Store } from "./store";
import { parseAdjustment, parseInvoice, parseTaxPeriod, requireClientTin, requireIdempotencyKey } from "./validation";

const EXEMPT = new Set(["/", "/health", "/_mock/reset"]);

export type App = {
  server: Server;
  ledger: Ledger;
  settings: Settings;
  limiter: RateLimiter;
  sleep: (seconds: number) => Promise<void>;
};

export async function createApp(
  settings: Settings,
  hooks: { sleep?: (seconds: number) => Promise<void>; store?: Store } = {},
): Promise<App> {
  const store = hooks.store ?? (await openStore(settings));
  const state: App = {
    settings,
    ledger: new Ledger(store),
    limiter: new RateLimiter(settings.rateLimit, settings.rateWindowSeconds * 1000),
    sleep: hooks.sleep ?? ((seconds) => new Promise((resolve) => setTimeout(resolve, seconds * 1000))),
    server: undefined as unknown as Server,
  };

  const server = createServer((req, res) => {
    readBody(req)
      .then((body) =>
        handleRequest(state, {
          method: req.method ?? "GET",
          path: new URL(req.url ?? "/", "http://127.0.0.1").pathname,
          query: new URL(req.url ?? "/", "http://127.0.0.1").search.replace(/^\?/, ""),
          headers: flattenHeaders(req.headers),
          body,
          remoteAddress: req.socket.remoteAddress ?? "local",
        }),
      )
      .then((result) => {
        if (!res.headersSent) sendJson(res, result.status, result.body, result.headers);
      })
      .catch((error: unknown) => {
        if (res.headersSent) return;
        console.error(error);
        sendJson(res, 500, { code: Code.SCHEMA, message: "Unexpected mock engine failure" });
      });
  });
  state.server = server;
  return state;
}

export async function handleRequest(state: App, call: ApiCall): Promise<ApiResult> {
  try {
    return await dispatch(state, call);
  } catch (error) {
    if (error instanceof RamisError) {
      return { status: error.status, headers: error.headers, body: errorBody(error) };
    }
    console.error(error);
    return { status: 500, headers: {}, body: { code: Code.SCHEMA, message: "Unexpected mock engine failure" } };
  }
}

async function dispatch(state: App, call: ApiCall): Promise<ApiResult> {
  const url = new URL(`${call.path}${call.query ? `?${call.query}` : ""}`, "http://127.0.0.1");
  const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : url.pathname;
  const method = call.method.toUpperCase();

  if (!EXEMPT.has(path)) {
    await applyChaos(state, call);
    const bucket = `${call.remoteAddress}:${header(call, "x-client-tin") ?? "anon"}`;
    if (!state.limiter.allow(bucket)) {
      throw new RamisError(429, Code.THROTTLE, "Request rate exceeds the mock throughput threshold", undefined, {
        "retry-after": String(state.settings.rateWindowSeconds),
      });
    }
  }

  if (method === "GET" && path === "/") {
    return json(200, {
      name: "RAMIS Web API Mock Engine",
      version: "1.0.0",
      health: "/health",
      oauth: "POST /oauth/v2/token",
      schedule01: "POST /api/v1/vat/schedule01/invoices",
      schedule04: "POST /api/v1/vat/schedule04/adjustments",
      schedule02: "GET /api/v1/vat/schedule02/purchases",
      approve: "POST /api/v1/vat/schedule02/approve",
    });
  }

  if (method === "GET" && path === "/health") {
    return json(200, {
      status: "ok",
      service: "ramis-mock",
      invoices: await state.ledger.invoiceCount(),
      adjustments: await state.ledger.adjustmentCount(),
    });
  }

  if (method === "POST" && path === "/_mock/reset") {
    requireBearer(header(call, "authorization"), state.settings.clientSecret);
    await state.ledger.reset();
    state.limiter.reset();
    return json(200, { status: "RESET" });
  }

  if (method === "POST" && path === "/oauth/v2/token") {
    const form = parseForm(header(call, "content-type"), call.body);
    const grantType = form.get("grant_type") ?? "";
    const clientId = (form.get("client_id") ?? "").trim();
    const clientSecret = form.get("client_secret") ?? "";
    if (grantType !== "client_credentials") {
      throw new RamisError(400, Code.AUTH, "grant_type must be client_credentials", "grant_type");
    }
    if (!clientId || clientId.length > 128) {
      throw new RamisError(401, Code.AUTH, "client_id is not valid", "client_id");
    }
    if (!secretsMatch(clientSecret, state.settings.clientSecret)) {
      throw new RamisError(401, Code.AUTH, "client_secret is not valid", "client_secret");
    }
    return json(200, issueToken(clientId, state.settings.clientSecret, state.settings.tokenTtlSeconds));
  }

  if (method === "POST" && path === "/api/v1/vat/schedule01/invoices") {
    requireBearer(header(call, "authorization"), state.settings.clientSecret);
    const clientTin = requireClientTin(header(call, "x-client-tin"));
    const idempotencyKey = requireIdempotencyKey(header(call, "x-idempotency-key"));
    const invoice = parseInvoice(parseJson(header(call, "content-type"), call.body), clientTin);
    return json(201, await state.ledger.clearInvoice(invoice, idempotencyKey));
  }

  if (method === "POST" && path === "/api/v1/vat/schedule04/adjustments") {
    requireBearer(header(call, "authorization"), state.settings.clientSecret);
    const clientTin = requireClientTin(header(call, "x-client-tin"));
    const idempotencyKey = requireIdempotencyKey(header(call, "x-idempotency-key"));
    const adjustment = parseAdjustment(parseJson(header(call, "content-type"), call.body), clientTin);
    return json(201, await state.ledger.clearAdjustment(adjustment, idempotencyKey));
  }

  if (method === "GET" && path === "/api/v1/vat/schedule02/purchases") {
    requireBearer(header(call, "authorization"), state.settings.clientSecret);
    const buyerTin = requireClientTin(header(call, "x-client-tin"));
    const taxPeriod = parseTaxPeriod(url.searchParams.get("tax_period"), "tax_period");
    const status = parsePurchaseStatus(url.searchParams.get("status"));
    const page = positiveInt(url.searchParams.get("page"), "page", 1);
    const pageSize = positiveInt(url.searchParams.get("page_size"), "page_size", state.settings.pageSizeDefault);
    if (pageSize > state.settings.pageSizeMax) {
      throw new RamisError(422, Code.SCHEMA, `page_size cannot exceed ${state.settings.pageSizeMax}`, "page_size");
    }
    const { total, records } = await state.ledger.purchases(buyerTin, taxPeriod, status, page, pageSize);
    return json(200, { tax_period: taxPeriod, buyer_tin: buyerTin, total_records: total, records });
  }

  if (method === "POST" && path === "/api/v1/vat/schedule02/approve") {
    requireBearer(header(call, "authorization"), state.settings.clientSecret);
    const clientTin = requireClientTin(header(call, "x-client-tin"));
    const body = asRecord(parseJson(header(call, "content-type"), call.body));
    const buyerTin = requireClientTin(typeof body.buyer_tin === "number" ? String(body.buyer_tin) : stringOrUndefined(body.buyer_tin));
    if (buyerTin !== clientTin) {
      throw new RamisError(422, Code.TIN, "buyer_tin must match X-Client-TIN", "buyer_tin");
    }
    const taxPeriod = parseTaxPeriod(body.tax_period, "tax_period");
    const recordIds = readRecordIds(body.record_ids, state.settings.approvalBatchMax);
    return json(200, await state.ledger.approve(buyerTin, taxPeriod, recordIds));
  }

  const invoiceSerial = serialParam(path, "/api/v1/vat/schedule01/invoices/");
  if (invoiceSerial && (method === "PUT" || method === "PATCH" || method === "DELETE")) {
    requireBearer(header(call, "authorization"), state.settings.clientSecret);
    if (!(await state.ledger.hasInvoice(invoiceSerial))) {
      throw new RamisError(404, Code.SCHEMA, `Invoice '${invoiceSerial}' was not found`);
    }
    throw new RamisError(409, Code.IMMUTABLE, immutableInvoice(invoiceSerial), "header.serial_number");
  }

  const adjustmentSerial = serialParam(path, "/api/v1/vat/schedule04/adjustments/");
  if (adjustmentSerial && (method === "PUT" || method === "PATCH" || method === "DELETE")) {
    requireBearer(header(call, "authorization"), state.settings.clientSecret);
    if (!(await state.ledger.hasAdjustment(adjustmentSerial))) {
      throw new RamisError(404, Code.SCHEMA, `Adjustment '${adjustmentSerial}' was not found`);
    }
    throw new RamisError(
      409,
      Code.IMMUTABLE,
      `Adjustment '${adjustmentSerial}' has already been cleared. RAMIS records are immutable and cannot be modified.`,
      "header.adjustment_serial_number",
    );
  }

  return json(404, { code: Code.SCHEMA, message: `No ${method} ${path}` });
}

function json(status: number, body: unknown, headers: Record<string, string> = {}): ApiResult {
  return { status, headers, body };
}

function header(call: ApiCall, name: string): string | undefined {
  return call.headers[name.toLowerCase()];
}

function flattenHeaders(headers: NodeJS.Dict<string | string[] | undefined>): Record<string, string | undefined> {
  const flat: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(headers)) {
    flat[key.toLowerCase()] = Array.isArray(value) ? value[0] : value;
  }
  return flat;
}

async function applyChaos(state: App, call: ApiCall): Promise<void> {
  const headerDelay = header(call, "x-mock-delay");
  let delay = state.settings.defaultDelaySeconds;
  if (headerDelay !== undefined) {
    if (!/^\d+$/.test(headerDelay)) {
      throw new RamisError(422, Code.SCHEMA, "X-Mock-Delay must be a whole number of seconds", "X-Mock-Delay");
    }
    delay = Number(headerDelay);
    if (delay > state.settings.maxDelaySeconds) {
      throw new RamisError(
        422,
        Code.SCHEMA,
        `X-Mock-Delay cannot exceed ${state.settings.maxDelaySeconds} seconds`,
        "X-Mock-Delay",
      );
    }
  }
  if (delay > 0) await state.sleep(delay);

  const requested = (header(call, "x-mock-chaos") ?? "").trim().toLowerCase();
  if (requested && requested !== "outage" && requested !== "throttle") {
    throw new RamisError(422, Code.SCHEMA, "X-Mock-Chaos must be outage or throttle", "X-Mock-Chaos");
  }
  const chaos = requested || (state.settings.forceOutage ? "outage" : state.settings.forceThrottle ? "throttle" : "");
  if (chaos === "outage") {
    throw new RamisError(503, Code.OUTAGE, "RAMIS gateway is unavailable (simulated maintenance window)", undefined, {
      "retry-after": "30",
    });
  }
  if (chaos === "throttle") {
    throw new RamisError(429, Code.THROTTLE, "Request rate exceeds the mock throughput threshold", undefined, {
      "retry-after": "1",
    });
  }
}

function parsePurchaseStatus(value: string | null): "UNAPPROVED" | "MATCHED" | undefined {
  if (value === null || value === "") return undefined;
  if (value === "UNAPPROVED" || value === "MATCHED") return value;
  throw new RamisError(422, Code.SCHEMA, "status must be UNAPPROVED or MATCHED", "status");
}

function positiveInt(value: string | null, field: string, fallback: number): number {
  if (value === null || value === "") return fallback;
  if (!/^[1-9][0-9]*$/.test(value)) {
    throw new RamisError(422, Code.SCHEMA, `${field} must be a positive integer`, field);
  }
  return Number(value);
}

function serialParam(path: string, prefix: string): string | undefined {
  if (!path.startsWith(prefix)) return undefined;
  const rest = path.slice(prefix.length);
  if (!rest || rest.includes("/")) return undefined;
  try {
    return decodeURIComponent(rest);
  } catch {
    return undefined;
  }
}

function readRecordIds(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) {
    throw new RamisError(422, Code.SCHEMA, "record_ids must be a list of record ids", "record_ids");
  }
  if (value.length === 0) {
    throw new RamisError(422, Code.SCHEMA, "record_ids must include at least one record", "record_ids");
  }
  if (value.length > max) {
    throw new RamisError(422, Code.SCHEMA, `record_ids cannot exceed ${max} records`, "record_ids");
  }
  return value.map((id) => {
    if (typeof id !== "string" || id.trim() === "") {
      throw new RamisError(422, Code.SCHEMA, "record_ids must be a list of record ids", "record_ids");
    }
    return id;
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new RamisError(422, Code.SCHEMA, "body must be an object", "body");
  }
  return value as Record<string, unknown>;
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  allow(key: string): boolean {
    if (this.limit <= 0) return true;
    const now = Date.now();
    const recent = (this.hits.get(key) ?? []).filter((at) => now - at < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }

  reset(): void {
    this.hits.clear();
  }
}
