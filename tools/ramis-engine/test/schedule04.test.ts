import assert from "node:assert/strict";
import test from "node:test";
import { login, postJson, readError, withServer } from "./helpers";
import { sampleCreditNote, sampleInvoice } from "./payloads";

test("links a credit note to the cleared invoice and blocks an over-claim", async () => {
  await withServer(async ({ baseUrl }) => {
    const token = await login(baseUrl);
    assert.equal((await postJson(baseUrl, "/api/v1/vat/schedule01/invoices", token, "104829102", sampleInvoice())).status, 201);

    const missing = await postJson(baseUrl, "/api/v1/vat/schedule04/adjustments", token, "104829102", {
      ...sampleCreditNote(),
      header: { ...sampleCreditNote().header, original_invoice_serial_number: "26OCT_HQ01_99999" },
    });
    assert.equal(missing.status, 404);
    assert.equal((await readError(missing)).code, "RAMIS_ERR_007");

    const cleared = await postJson(baseUrl, "/api/v1/vat/schedule04/adjustments", token, "104829102", sampleCreditNote());
    assert.equal(cleared.status, 201);
    const note = (await cleared.json()) as {
      status: string;
      ramis_adjustment_token: string;
      adjustment_serial_number: string;
      original_invoice_serial_number: string;
    };
    assert.equal(note.status, "CLEARED");
    assert.equal(note.adjustment_serial_number, "26OCT_HQ01_CR0012");
    assert.equal(note.original_invoice_serial_number, "26OCT_HQ01_1042");
    assert.match(note.ramis_adjustment_token, /^RAMIS-ADJ-\d{8}-[0-9A-F]{8}$/);

    const tooLarge = structuredClone(sampleCreditNote());
    tooLarge.header.adjustment_serial_number = "26OCT_HQ01_CR0013";
    tooLarge.adjustment_values = {
      adjusted_value_excluding_vat: 1_000_000,
      vat_rate: 18,
      adjusted_vat_amount: 180_000,
      adjusted_total_consideration: 1_180_000,
    };
    const over = await postJson(baseUrl, "/api/v1/vat/schedule04/adjustments", token, "104829102", tooLarge);
    assert.equal(over.status, 422);
    assert.equal((await readError(over)).code, "RAMIS_ERR_008");

    const mismatch = structuredClone(sampleCreditNote());
    mismatch.header.adjustment_serial_number = "26OCT_HQ01_CR0014";
    mismatch.purchaser.tin = "134567890";
    mismatch.purchaser.name = "Someone Else";
    const unlinked = await postJson(baseUrl, "/api/v1/vat/schedule04/adjustments", token, "104829102", mismatch);
    assert.equal(unlinked.status, 422);
    assert.equal((await readError(unlinked)).code, "RAMIS_ERR_007");

    const removed = await fetch(`${baseUrl}/api/v1/vat/schedule04/adjustments/${note.adjustment_serial_number}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(removed.status, 409);
    assert.equal((await readError(removed)).code, "RAMIS_ERR_006");
  });
});

test("a debit note increases the VAT that a later credit note can reverse", async () => {
  await withServer(async ({ baseUrl }) => {
    const token = await login(baseUrl);
    assert.equal((await postJson(baseUrl, "/api/v1/vat/schedule01/invoices", token, "104829102", sampleInvoice())).status, 201);

    const fullCredit = structuredClone(sampleCreditNote());
    fullCredit.header.adjustment_serial_number = "26OCT_HQ01_CR0100";
    fullCredit.adjustment_values = {
      adjusted_value_excluding_vat: 1_000_000,
      vat_rate: 18,
      adjusted_vat_amount: 180_000,
      adjusted_total_consideration: 1_180_000,
    };
    assert.equal((await postJson(baseUrl, "/api/v1/vat/schedule04/adjustments", token, "104829102", fullCredit)).status, 201);

    const debit = structuredClone(sampleCreditNote());
    debit.header.adjustment_serial_number = "26OCT_HQ01_DR0001";
    debit.header.adjustment_type = "TAX_DEBIT_NOTE";
    debit.header.adjustment_reason = "Price increase on the original supply";
    debit.adjustment_values = {
      adjusted_value_excluding_vat: 10_000,
      vat_rate: 18,
      adjusted_vat_amount: 1_800,
      adjusted_total_consideration: 11_800,
    };
    assert.equal((await postJson(baseUrl, "/api/v1/vat/schedule04/adjustments", token, "104829102", debit)).status, 201);

    const followUp = structuredClone(sampleCreditNote());
    followUp.header.adjustment_serial_number = "26OCT_HQ01_CR0101";
    followUp.adjustment_values = debit.adjustment_values;
    assert.equal((await postJson(baseUrl, "/api/v1/vat/schedule04/adjustments", token, "104829102", followUp)).status, 201);
  });
});
