import { createHmac, timingSafeEqual } from "node:crypto";
import { Code, RamisError } from "./errors";

export const TOKEN_SCOPE = "vat:schedule01:write vat:schedule02:read vat:schedule04:write";

export type AccessToken = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  scope: string;
};

type Claims = {
  iss: string;
  sub: string;
  scope: string;
  iat: number;
  exp: number;
};

export function issueToken(clientId: string, secret: string, ttlSeconds: number, nowSeconds = unixNow()): AccessToken {
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({
      iss: "https://ramis.ird.gov.lk/mock",
      sub: clientId,
      scope: TOKEN_SCOPE,
      iat: nowSeconds,
      exp: nowSeconds + ttlSeconds,
    } satisfies Claims),
  );
  const signature = sign(`${header}.${payload}`, secret);
  return {
    access_token: `ramis_sec_jwt_${header}.${payload}.${signature}`,
    token_type: "Bearer",
    expires_in: ttlSeconds,
    scope: TOKEN_SCOPE,
  };
}

export function requireBearer(authorization: string | undefined, secret: string): Claims {
  if (!authorization || !/^Bearer\s+\S+/i.test(authorization)) {
    throw new RamisError(401, Code.AUTH, "Bearer access token is required", "Authorization", {
      "www-authenticate": "Bearer",
    });
  }
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  return verifyToken(token, secret);
}

export function secretsMatch(provided: string, expected: string): boolean {
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length) {
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

function verifyToken(token: string, secret: string): Claims {
  if (!token.startsWith("ramis_sec_jwt_")) {
    throw unauthorized("Access token is not valid");
  }
  const jwt = token.slice("ramis_sec_jwt_".length);
  const parts = jwt.split(".");
  if (parts.length !== 3) throw unauthorized("Access token is not valid");
  const [header, payload, signature] = parts;
  if (!header || !payload || !signature) throw unauthorized("Access token is not valid");
  const expected = sign(`${header}.${payload}`, secret);
  if (!sameText(signature, expected)) throw unauthorized("Access token is not valid");

  let claims: Claims;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Claims;
  } catch {
    throw unauthorized("Access token is not valid");
  }
  if (!claims.exp || claims.exp <= unixNow()) {
    throw unauthorized("Access token has expired");
  }
  return claims;
}

function unauthorized(message: string): RamisError {
  return new RamisError(401, Code.AUTH, message, "Authorization", { "www-authenticate": "Bearer" });
}

function sign(input: string, secret: string): string {
  return createHmac("sha256", secret).update(input).digest("base64url");
}

function base64Url(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function sameText(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function unixNow(): number {
  return Math.floor(Date.now() / 1000);
}
