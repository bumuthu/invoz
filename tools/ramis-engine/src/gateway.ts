export type ApiCall = {
  method: string;
  path: string;
  query: string;
  headers: Record<string, string | undefined>;
  body: string;
  remoteAddress: string;
};

export type ApiResult = {
  status: number;
  headers: Record<string, string>;
  body: unknown;
};

type HeaderMap = Record<string, string | undefined>;

export function fromApiGateway(event: unknown): ApiCall {
  if (!isRecord(event)) {
    throw new Error("API Gateway event is required");
  }
  if (event.version === "2.0" || typeof event.rawPath === "string") {
    return fromHttpApi(event);
  }
  if (typeof event.httpMethod === "string") {
    return fromRestApi(event);
  }
  throw new Error("Unsupported API Gateway event");
}

export function toApiGateway(result: ApiResult): {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
} {
  const type = result.headers["content-type"];
  const body = result.body;
  const raw = typeof body === "string" && Boolean(type) && !type.includes("json");
  return {
    statusCode: result.status,
    headers: {
      ...(raw ? {} : { "content-type": "application/json; charset=utf-8" }),
      ...result.headers,
    },
    body: raw ? body : JSON.stringify(body),
  };
}

function fromHttpApi(event: Record<string, unknown>): ApiCall {
  const context = isRecord(event.requestContext) ? event.requestContext : {};
  const http = isRecord(context.http) ? context.http : {};
  const method = typeof http.method === "string" ? http.method : "GET";
  const path = typeof event.rawPath === "string" ? event.rawPath : "/";
  const query = typeof event.rawQueryString === "string" ? event.rawQueryString : "";
  return {
    method,
    path,
    query,
    headers: headersOf(event.headers),
    body: bodyOf(event.body, event.isBase64Encoded),
    remoteAddress: typeof http.sourceIp === "string" ? http.sourceIp : "gateway",
  };
}

function fromRestApi(event: Record<string, unknown>): ApiCall {
  const context = isRecord(event.requestContext) ? event.requestContext : {};
  const identity = isRecord(context.identity) ? context.identity : {};
  const path = typeof event.path === "string" ? event.path : "/";
  const query = new URLSearchParams();
  if (isRecord(event.queryStringParameters)) {
    for (const [key, value] of Object.entries(event.queryStringParameters)) {
      if (typeof value === "string") query.set(key, value);
    }
  }
  return {
    method: String(event.httpMethod),
    path,
    query: query.toString(),
    headers: headersOf(event.headers),
    body: bodyOf(event.body, event.isBase64Encoded),
    remoteAddress: typeof identity.sourceIp === "string" ? identity.sourceIp : "gateway",
  };
}

function headersOf(value: unknown): HeaderMap {
  if (!isRecord(value)) return {};
  const headers: HeaderMap = {};
  for (const [key, header] of Object.entries(value)) {
    if (typeof header === "string") headers[key.toLowerCase()] = header;
  }
  return headers;
}

function bodyOf(value: unknown, encoded: unknown): string {
  if (typeof value !== "string" || value.length === 0) return "";
  if (encoded === true) return Buffer.from(value, "base64").toString("utf8");
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
