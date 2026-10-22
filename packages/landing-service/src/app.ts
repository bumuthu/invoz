import { corsHeaders } from "./cors";
import { routes } from "./routes";
import type { HttpResult, LandingRequest } from "./types";

export type IncomingCall = {
  method: string;
  path: string;
  headers: Record<string, string | undefined>;
  rawBody: string;
};

export async function dispatchHttp(call: IncomingCall): Promise<HttpResult> {
  const origin = header(call.headers, "origin");
  const headers = {
    "content-type": "application/json; charset=utf-8",
    ...corsHeaders(origin),
  };

  if (call.method === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  const path = call.path.length > 1 ? call.path.replace(/\/+$/, "") : call.path;
  const match = routes.find((route) => route.method === call.method && route.path === path);
  if (!match) {
    return { statusCode: 404, headers, body: JSON.stringify({ error: "Not found." }) };
  }

  let json: unknown = null;
  if (call.rawBody) {
    try {
      json = JSON.parse(call.rawBody) as unknown;
    } catch {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Send the form as JSON." }) };
    }
  }

  const request: LandingRequest = {
    method: call.method,
    path,
    headers: call.headers,
    json,
  };

  try {
    const result = await match.handle(request);
    return { statusCode: result.status, headers, body: JSON.stringify(result.body) };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "The request could not be completed." }) };
  }
}

function header(headers: Record<string, string | undefined>, name: string) {
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted) return value;
  }
  return undefined;
}
