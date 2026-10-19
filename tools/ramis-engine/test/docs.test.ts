import assert from "node:assert/strict";
import test from "node:test";
import { withServer } from "./helpers";

test("hosts the OpenAPI document and Swagger UI", async () => {
  await withServer(async ({ baseUrl }) => {
    const spec = await fetch(`${baseUrl}/openapi.yaml`);
    assert.equal(spec.status, 200);
    assert.match(spec.headers.get("content-type") ?? "", /yaml/);
    const yaml = await spec.text();
    assert.match(yaml, /^openapi: 3\.0\.3/m);
    assert.match(yaml, /\/api\/v1\/vat\/schedule01\/invoices/);

    const docs = await fetch(`${baseUrl}/docs`);
    assert.equal(docs.status, 200);
    assert.match(await docs.text(), /swagger-ui/);
  });
});
