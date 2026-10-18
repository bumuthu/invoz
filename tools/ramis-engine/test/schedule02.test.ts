import assert from "node:assert/strict";
import test from "node:test";
import { login, postJson, readError, withServer } from "./helpers";
import { sampleInvoice } from "./payloads";

test("mirrors a cleared sale onto the purchaser Schedule 02 ledger", async () => {
  await withServer(async ({ baseUrl }) => {
    const seller = await login(baseUrl, "104829102");
    const buyer = await login(baseUrl, "709182341");
    const created = await postJson(baseUrl, "/api/v1/vat/schedule01/invoices", seller, "104829102", sampleInvoice());
    assert.equal(created.status, 201);

    const sellerLedger = await fetch(`${baseUrl}/api/v1/vat/schedule02/purchases?tax_period=2026-10`, {
      headers: { authorization: `Bearer ${seller}`, "x-client-tin": "104829102" },
    });
    assert.equal(sellerLedger.status, 200);
    assert.equal(((await sellerLedger.json()) as { total_records: number }).total_records, 0);

    const purchases = await fetch(`${baseUrl}/api/v1/vat/schedule02/purchases?tax_period=2026-10&status=UNAPPROVED&page=1&page_size=500`, {
      headers: { authorization: `Bearer ${buyer}`, "x-client-tin": "709182341" },
    });
    assert.equal(purchases.status, 200);
    const ledger = (await purchases.json()) as {
      tax_period: string;
      buyer_tin: string;
      total_records: number;
      records: { ramis_record_id: string; supplier_invoice_serial: string; vat_amount: number; approval_status: string }[];
    };
    assert.equal(ledger.tax_period, "2026-10");
    assert.equal(ledger.buyer_tin, "709182341");
    assert.equal(ledger.total_records, 1);
    assert.equal(ledger.records[0]?.supplier_invoice_serial, "26OCT_HQ01_1042");
    assert.equal(ledger.records[0]?.vat_amount, 180_000);
    assert.equal(ledger.records[0]?.approval_status, "PENDING_REVIEW");
    assert.equal(ledger.records[0]?.ramis_record_id, "REC-8849201");

    const otherPeriod = await fetch(`${baseUrl}/api/v1/vat/schedule02/purchases?tax_period=2026-09`, {
      headers: { authorization: `Bearer ${buyer}`, "x-client-tin": "709182341" },
    });
    assert.equal(((await otherPeriod.json()) as { total_records: number }).total_records, 0);

    const approved = await postJson(baseUrl, "/api/v1/vat/schedule02/approve", buyer, "709182341", {
      buyer_tin: "709182341",
      tax_period: "2026-10",
      record_ids: [ledger.records[0]!.ramis_record_id, "REC-MISSING"],
    });
    assert.equal(approved.status, 200);
    const batch = (await approved.json()) as {
      status: string;
      records_approved: number;
      records_failed: number;
      status_updated_to: string;
      approval_batch_reference: string;
    };
    assert.equal(batch.status, "PARTIAL");
    assert.equal(batch.records_approved, 1);
    assert.equal(batch.records_failed, 1);
    assert.equal(batch.status_updated_to, "Matched");
    assert.match(batch.approval_batch_reference, /^BAT-\d{6}-\d+$/);

    const again = await postJson(baseUrl, "/api/v1/vat/schedule02/approve", buyer, "709182341", {
      buyer_tin: "709182341",
      tax_period: "2026-10",
      record_ids: [ledger.records[0]!.ramis_record_id],
    });
    const second = (await again.json()) as { status: string; records_approved: number };
    assert.equal(second.status, "SUCCESS");
    assert.equal(second.records_approved, 1);

    const matched = await fetch(`${baseUrl}/api/v1/vat/schedule02/purchases?tax_period=2026-10&status=MATCHED`, {
      headers: { authorization: `Bearer ${buyer}`, "x-client-tin": "709182341" },
    });
    const matchedBody = (await matched.json()) as { total_records: number; records: { approval_status: string }[] };
    assert.equal(matchedBody.total_records, 1);
    assert.equal(matchedBody.records[0]?.approval_status, "MATCHED");

    const pending = await fetch(`${baseUrl}/api/v1/vat/schedule02/purchases?tax_period=2026-10&status=UNAPPROVED`, {
      headers: { authorization: `Bearer ${buyer}`, "x-client-tin": "709182341" },
    });
    assert.equal(((await pending.json()) as { total_records: number }).total_records, 0);

    const wrongActor = await postJson(baseUrl, "/api/v1/vat/schedule02/approve", seller, "104829102", {
      buyer_tin: "709182341",
      tax_period: "2026-10",
      record_ids: [ledger.records[0]!.ramis_record_id],
    });
    assert.equal(wrongActor.status, 422);
    assert.equal((await readError(wrongActor)).code, "RAMIS_ERR_001");
  });
});

test("rejects approval batches above the 5000 record notice limit and page sizes above 5000", async () => {
  await withServer(async ({ baseUrl }) => {
    const buyer = await login(baseUrl, "709182341");
    const tooMany = await postJson(baseUrl, "/api/v1/vat/schedule02/approve", buyer, "709182341", {
      buyer_tin: "709182341",
      tax_period: "2026-10",
      record_ids: Array.from({ length: 5001 }, (_, index) => `REC-${index}`),
    });
    assert.equal(tooMany.status, 422);

    const page = await fetch(`${baseUrl}/api/v1/vat/schedule02/purchases?tax_period=2026-10&page_size=5001`, {
      headers: { authorization: `Bearer ${buyer}`, "x-client-tin": "709182341" },
    });
    assert.equal(page.status, 422);
  });
});
