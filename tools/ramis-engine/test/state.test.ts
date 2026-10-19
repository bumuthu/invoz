import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { issueToken } from "../src/auth";
import { fromApiGateway, type ApiCall } from "../src/gateway";
import { PostgresStore } from "../src/postgres-store";
import { createApp, handleRequest } from "../src/server";
import type { Sql } from "../src/sql";
import { testSettings } from "./helpers";
import { sampleCreditNote, sampleInvoice } from "./payloads";

test("a new engine instance reads clearance state from the database", async () => {
  const database = new PGlite();
  const migration = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../migrations/0001_ledger.sql");
  await database.exec(await readFile(migration, "utf8"));
  const sql = pgliteSql(database);
  const first = await createApp(testSettings(), { store: new PostgresStore(sql) });
  const token = issueToken("104829102", "ramis-mock-secret", 3600).access_token;
  const key = randomUUID();

  const created = await handleRequest(first, gateway("POST", "/api/v1/vat/schedule01/invoices", sampleInvoice(), {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "x-client-tin": "104829102",
    "x-idempotency-key": key,
  }));
  assert.equal(created.status, 201);
  const clearance = created.body as { ramis_clearance_token: string; serial_number: string };
  assert.equal(clearance.serial_number, "26OCT_HQ01_1042");

  const second = await createApp(testSettings(), { store: new PostgresStore(sql) });
  const replay = await handleRequest(second, gateway("POST", "/api/v1/vat/schedule01/invoices", sampleInvoice(), {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "x-client-tin": "104829102",
    "x-idempotency-key": key,
  }));
  assert.equal(replay.status, 201);
  assert.equal((replay.body as { ramis_clearance_token: string }).ramis_clearance_token, clearance.ramis_clearance_token);

  const purchases = await handleRequest(
    second,
    gateway("GET", "/api/v1/vat/schedule02/purchases", undefined, {
      authorization: `Bearer ${token}`,
      "x-client-tin": "709182341",
    }, "tax_period=2026-10"),
  );
  assert.equal(purchases.status, 200);
  const ledger = purchases.body as { total_records: number; records: { ramis_record_id: string }[] };
  assert.equal(ledger.total_records, 1);
  assert.equal(ledger.records[0]?.ramis_record_id, "REC-8849201");

  const tooLarge = sampleCreditNote();
  tooLarge.adjustment_values.adjusted_vat_amount = 200_000;
  tooLarge.header.adjustment_serial_number = "26OCT_HQ01_CR9000";
  const rejected = await handleRequest(second, gateway("POST", "/api/v1/vat/schedule04/adjustments", tooLarge, {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "x-client-tin": "104829102",
    "x-idempotency-key": randomUUID(),
  }));
  assert.equal(rejected.status, 422);

  const credited = await handleRequest(second, gateway("POST", "/api/v1/vat/schedule04/adjustments", sampleCreditNote(), {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "x-client-tin": "104829102",
    "x-idempotency-key": randomUUID(),
  }));
  assert.equal(credited.status, 201);

  const health = await handleRequest(await createApp(testSettings(), { store: new PostgresStore(sql) }), gateway("GET", "/health"));
  assert.deepEqual(health.body, { status: "ok", service: "ramis-mock", invoices: 1, adjustments: 1 });
});

function gateway(
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
  query = "",
): ApiCall {
  return fromApiGateway({
    version: "2.0",
    rawPath: path,
    rawQueryString: query,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    isBase64Encoded: false,
    requestContext: { http: { method, sourceIp: "203.0.113.10" } },
  });
}

function pgliteSql(database: PGlite): Sql {
  return {
    async query<T extends Record<string, unknown>>(text: string, params: unknown[] = []) {
      const result = await database.query<T>(text, params);
      return { rows: result.rows };
    },
    transaction(fn) {
      return database.transaction((tx) => fn(pgliteSql(tx as unknown as PGlite)));
    },
  };
}
