import { dispatchHttp, type IncomingCall } from "./app";

export async function handler(event: unknown) {
  try {
    return await dispatchHttp(fromApiGateway(event));
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ error: "The request could not be completed." }),
    };
  }
}

function fromApiGateway(event: unknown): IncomingCall {
  if (!isRecord(event)) {
    throw new Error("API Gateway event is required");
  }
  const context = isRecord(event.requestContext) ? event.requestContext : {};
  const http = isRecord(context.http) ? context.http : {};
  const method =
    typeof http.method === "string"
      ? http.method
      : typeof event.httpMethod === "string"
        ? event.httpMethod
        : "GET";
  const path =
    typeof event.rawPath === "string" ? event.rawPath : typeof event.path === "string" ? event.path : "/";
  return {
    method: method.toUpperCase(),
    path,
    headers: headersOf(event.headers),
    rawBody: bodyOf(event.body, event.isBase64Encoded),
  };
}

function headersOf(value: unknown): Record<string, string | undefined> {
  if (!isRecord(value)) return {};
  const headers: Record<string, string | undefined> = {};
  for (const [key, item] of Object.entries(value)) {
    headers[key.toLowerCase()] = typeof item === "string" ? item : undefined;
  }
  return headers;
}

function bodyOf(value: unknown, encoded: unknown) {
  if (typeof value !== "string" || !value) return "";
  if (encoded === true) return Buffer.from(value, "base64").toString("utf8");
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
