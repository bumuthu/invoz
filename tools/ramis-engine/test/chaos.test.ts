import assert from "node:assert/strict";
import test from "node:test";
import { login, postJson, readError, withServer } from "./helpers";
import { sampleInvoice } from "./payloads";

test("oauth issues a bearer token and rejects a bad secret", async () => {
  await withServer(async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/oauth/v2/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: "104829102",
        client_secret: "ramis-mock-secret",
      }),
    });
    assert.equal(response.status, 200);
    const token = (await response.json()) as { token_type: string; expires_in: number; scope: string; access_token: string };
    assert.equal(token.token_type, "Bearer");
    assert.equal(token.expires_in, 3600);
    assert.match(token.access_token, /^ramis_sec_jwt_/);
    assert.match(token.scope, /vat:schedule01:write/);
    assert.match(token.scope, /vat:schedule02:read/);
    assert.match(token.scope, /vat:schedule04:write/);

    const rejected = await fetch(`${baseUrl}/oauth/v2/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: "104829102",
        client_secret: "wrong",
      }),
    });
    assert.equal(rejected.status, 401);
  });
});

test("chaos headers simulate outage, throttle, and latency without clearing the invoice", async () => {
  const delays: number[] = [];
  await withServer(
    async ({ baseUrl }) => {
      const token = await login(baseUrl);
      const outage = await postJson(baseUrl, "/api/v1/vat/schedule01/invoices", token, "104829102", sampleInvoice(), {
        "x-mock-chaos": "outage",
      });
      assert.equal(outage.status, 503);
      assert.equal((await readError(outage)).code, "RAMIS_ERR_010");

      const throttled = await postJson(baseUrl, "/api/v1/vat/schedule01/invoices", token, "104829102", sampleInvoice(), {
        "x-mock-chaos": "throttle",
      });
      assert.equal(throttled.status, 429);
      assert.equal((await readError(throttled)).code, "RAMIS_ERR_009");

      const delayed = await postJson(baseUrl, "/api/v1/vat/schedule01/invoices", token, "104829102", sampleInvoice(), {
        "x-mock-delay": "15",
      });
      assert.equal(delayed.status, 201);
      assert.deepEqual(delays, [15]);

      const health = await fetch(`${baseUrl}/health`);
      assert.equal(((await health.json()) as { invoices: number }).invoices, 1);
    },
    { sleep: async (seconds) => void delays.push(seconds) },
  );
});

test("force-outage and the request ceiling return gateway errors", async () => {
  await withServer(
    async ({ baseUrl }) => {
      const response = await fetch(`${baseUrl}/oauth/v2/token`, { method: "POST" });
      assert.equal(response.status, 503);
      assert.equal((await readError(response)).code, "RAMIS_ERR_010");
      const health = await fetch(`${baseUrl}/health`);
      assert.equal(health.status, 200);
    },
    { settings: { forceOutage: true } },
  );

  await withServer(
    async ({ baseUrl }) => {
      const send = () =>
        fetch(`${baseUrl}/oauth/v2/token`, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "client_credentials",
            client_id: "104829102",
            client_secret: "ramis-mock-secret",
          }),
        });
      assert.equal((await send()).status, 200);
      assert.equal((await send()).status, 200);
      const blocked = await send();
      assert.equal(blocked.status, 429);
      assert.equal((await readError(blocked)).code, "RAMIS_ERR_009");
    },
    { settings: { rateLimit: 2, rateWindowSeconds: 60 } },
  );
});
