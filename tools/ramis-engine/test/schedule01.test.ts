import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { issueToken } from "../src/auth";
import { jsonHeaders, login, postJson, readError, withServer } from "./helpers";
import { sampleInvoice } from "./payloads";

const INVOICES = "/api/v1/vat/schedule01/invoices";

test("clears a standard tax invoice and rejects a later change", async () => {
  await withServer(async ({ baseUrl }) => {
    const token = await login(baseUrl);
    const created = await postJson(baseUrl, INVOICES, token, "104829102", sampleInvoice());
    assert.equal(created.status, 201);
    const clearance = (await created.json()) as {
      status: string;
      ramis_clearance_token: string;
      serial_number: string;
      supplier_tin: string;
      purchaser_tin: string;
      qr_payload: string;
      warnings: string[];
    };
    assert.equal(clearance.status, "CLEARED");
    assert.equal(clearance.serial_number, "26OCT_HQ01_1042");
    assert.equal(clearance.supplier_tin, "104829102");
    assert.equal(clearance.purchaser_tin, "709182341");
    assert.match(clearance.ramis_clearance_token, /^RAMIS-CLR-\d{8}-[0-9A-F]{8}$/);
    assert.match(clearance.qr_payload, /tin=104829102/);
    assert.match(clearance.qr_payload, /sn=26OCT_HQ01_1042/);
    assert.deepEqual(clearance.warnings, []);

    const key = randomUUID();
    const replay = await postJson(baseUrl, INVOICES, token, "104829102", sampleInvoice(), {
      "x-idempotency-key": key,
    });
    assert.equal(replay.status, 201);
    const replayed = (await replay.json()) as { ramis_clearance_token: string };
    assert.equal(replayed.ramis_clearance_token, clearance.ramis_clearance_token);

    const changed = structuredClone(sampleInvoice());
    changed.header.erp_reference = "SAP-INV-CHANGED";
    const conflict = await postJson(baseUrl, INVOICES, token, "104829102", changed);
    assert.equal(conflict.status, 409);
    const error = await readError(conflict);
    assert.equal(error.code, "RAMIS_ERR_006");

    const reused = await postJson(baseUrl, INVOICES, token, "104829102", changed, { "x-idempotency-key": key });
    assert.equal(reused.status, 409);
    assert.equal((await readError(reused)).code, "RAMIS_ERR_006");

    const removed = await fetch(`${baseUrl}${INVOICES}/${clearance.serial_number}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(removed.status, 409);
    assert.equal((await readError(removed)).code, "RAMIS_ERR_006");
  });
});

test("returns the statutory validation codes", async () => {
  await withServer(async ({ baseUrl }) => {
    const token = await login(baseUrl);
    const cases: { mutate: (body: ReturnType<typeof sampleInvoice>) => void; status: number; code: string }[] = [
      {
        mutate: (body) => {
          body.supplier.tin = "10482910";
        },
        status: 422,
        code: "RAMIS_ERR_001",
      },
      {
        mutate: (body) => {
          body.header.serial_number = "26OCT HQ01_1042";
        },
        status: 422,
        code: "RAMIS_ERR_002",
      },
      {
        mutate: (body) => {
          body.header.invoice_date = "2026-11-01";
        },
        status: 422,
        code: "RAMIS_ERR_003",
      },
      {
        mutate: (body) => {
          delete (body.header as { supply_date?: string }).supply_date;
        },
        status: 422,
        code: "RAMIS_ERR_004",
      },
      {
        mutate: (body) => {
          body.currency_summary.total_consideration_including_vat = 1_180_001;
        },
        status: 422,
        code: "RAMIS_ERR_005",
      },
    ];

    for (const [index, entry] of cases.entries()) {
      const body = structuredClone(sampleInvoice());
      body.header.serial_number = `26OCT_HQ01_${2000 + index}`;
      if (entry.code !== "RAMIS_ERR_003") body.header.invoice_date = "2026-10-18";
      entry.mutate(body);
      if (entry.code === "RAMIS_ERR_003") body.header.serial_number = "26OCT_HQ01_1042";
      const response = await postJson(baseUrl, INVOICES, token, "104829102", body);
      assert.equal(response.status, entry.status, entry.code);
      assert.equal((await readError(response)).code, entry.code);
    }

    const mismatch = await postJson(baseUrl, INVOICES, token, "709182341", sampleInvoice());
    assert.equal(mismatch.status, 422);
    assert.equal((await readError(mismatch)).code, "RAMIS_ERR_001");

    const anonymous = await fetch(`${baseUrl}${INVOICES}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-client-tin": "104829102", "x-idempotency-key": randomUUID() },
      body: JSON.stringify(sampleInvoice()),
    });
    assert.equal(anonymous.status, 401);

    const expired = issueToken("104829102", "ramis-mock-secret", -10);
    const stale = await fetch(`${baseUrl}${INVOICES}`, {
      method: "POST",
      headers: jsonHeaders(expired.access_token, "104829102"),
      body: JSON.stringify(sampleInvoice()),
    });
    assert.equal(stale.status, 401);
  });
});

test("clears financial services, zero-rated, and exempt invoices at their statutory rates", async () => {
  await withServer(async ({ baseUrl }) => {
    const token = await login(baseUrl);
    const financial = structuredClone(sampleInvoice());
    financial.header.serial_number = "26OCT_HQ01_3001";
    financial.header.invoice_type = "FINANCIAL_SERVICES";
    financial.currency_summary = {
      currency: "LKR",
      exchange_rate: 1,
      total_value_excluding_vat: 100_000,
      vat_rate: 20.5,
      total_vat_amount: 20_500,
      total_consideration_including_vat: 120_500,
    };
    financial.line_items[0] = {
      ...financial.line_items[0]!,
      quantity: 1,
      unit_price: 100_000,
      line_amount_excluding_vat: 100_000,
      vat_rate: 20.5,
      vat_amount: 20_500,
      line_total_including_vat: 120_500,
    };
    assert.equal((await postJson(baseUrl, INVOICES, token, "104829102", financial)).status, 201);

    const zeroRated = structuredClone(sampleInvoice());
    zeroRated.header.serial_number = "26OCT_HQ01_3002";
    zeroRated.header.invoice_type = "ZERO_RATED";
    zeroRated.currency_summary.vat_rate = 0;
    zeroRated.currency_summary.total_vat_amount = 0;
    zeroRated.currency_summary.total_consideration_including_vat = 1_000_000;
    zeroRated.line_items[0]!.vat_rate = 0;
    zeroRated.line_items[0]!.vat_amount = 0;
    zeroRated.line_items[0]!.line_total_including_vat = 1_000_000;
    assert.equal((await postJson(baseUrl, INVOICES, token, "104829102", zeroRated)).status, 201);

    const exempt = structuredClone(zeroRated);
    exempt.header.serial_number = "26OCT_HQ01_3003";
    exempt.header.invoice_type = "EXEMPT";
    exempt.currency_summary.vat_rate = 18;
    exempt.line_items[0]!.vat_rate = 18;
    const rejected = await postJson(baseUrl, INVOICES, token, "104829102", exempt);
    assert.equal(rejected.status, 422);
    assert.equal((await readError(rejected)).code, "RAMIS_ERR_005");
  });
});
