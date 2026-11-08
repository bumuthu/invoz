import assert from "node:assert/strict";
import test from "node:test";
import {
  billingDocumentUrl,
  buyerTin,
  compareInvoiceId,
  csvHeaders,
  invoiceCsv,
  invoiceObjectKey,
  mapBillingDocument,
  parseBillingPage,
  resolveBranchId,
  sapDate,
  sameOrigin,
} from "../src/billing";
import { pollBillingDocuments } from "../src/sap";

const branches = [{ id: 7, code: "1000" }];

test("billing document url filters from the last invoice id", () => {
  const first = new URL(billingDocumentUrl("https://sap.example/sap/opu/odata/sap/API_BILLING_DOCUMENT_SRV", null));
  assert.equal(first.searchParams.get("$top"), "100");
  assert.equal(first.searchParams.get("$orderby"), "BillingDocument asc");
  assert.equal(first.searchParams.get("$filter"), "(BillingDocumentType eq 'F2' or BillingDocumentType eq 'FX')");
  assert.equal(first.pathname.endsWith("/A_BillingDocument"), true);

  const next = new URL(
    billingDocumentUrl("https://sap.example/sap/opu/odata/sap/API_BILLING_DOCUMENT_SRV/", "0090000010"),
  );
  assert.match(next.searchParams.get("$filter") ?? "", /BillingDocument gt '0090000010'/);
});

test("a quoted invoice id is escaped in the filter", () => {
  const url = new URL(billingDocumentUrl("https://sap.example/svc", "O'Hara"));
  assert.match(url.searchParams.get("$filter") ?? "", /BillingDocument gt 'O''Hara'/);
});

test("parses OData v2 and v4 pages", () => {
  const v2 = parseBillingPage({ d: { results: [{ BillingDocument: "1" }], __next: "https://sap.example/next" } });
  assert.equal(v2.documents.length, 1);
  assert.equal(v2.nextUrl, "https://sap.example/next");
  const v4 = parseBillingPage({ value: [], "@odata.nextLink": null });
  assert.deepEqual(v4.documents, []);
  assert.equal(v4.nextUrl, null);
});

test("maps a billing document and skips a cancelled one", () => {
  const invoice = mapBillingDocument(
    {
      BillingDocument: "0090000011",
      BillingDocumentDate: "/Date(1730678400000)/",
      VATRegistration: "LK102345678",
      SoldToParty: "CUST1",
      TotalNetAmount: "1,500.5",
      TaxAmount: "270.00",
      CompanyCode: "1000",
    },
    branches,
  );
  assert.equal(invoice?.buyerTin, "102345678");
  assert.equal(invoice?.buyerName, "CUST1");
  assert.equal(invoice?.netAmount, "1500.50");
  assert.equal(invoice?.invoiceDate, sapDate("/Date(1730678400000)/", "0090000011"));
  assert.equal(
    mapBillingDocument({ BillingDocument: "2", BillingDocumentIsCancelled: true }, branches),
    null,
  );
});

test("one branch is used when the company code does not match", () => {
  assert.equal(resolveBranchId(branches, "9999", "1"), 7);
  assert.throws(() => resolveBranchId([{ id: 1, code: "A" }, { id: 2, code: "B" }], "9999", "1"));
});

test("csv uses the stored erp field names", () => {
  const headers = csvHeaders([
    { ramisField: "header.erp_reference", erpField: "header.erp_reference" },
    { ramisField: "header.invoice_date", erpField: "header.invoice_date" },
    { ramisField: "header.supply_date", erpField: "header.supply_date" },
    { ramisField: "purchaser.tin", erpField: "purchaser.tin" },
    { ramisField: "purchaser.name", erpField: "purchaser.name" },
    { ramisField: "currency_summary.total_value_excluding_vat", erpField: "Net" },
    { ramisField: "currency_summary.total_vat_amount", erpField: "VAT" },
  ]);
  const csv = invoiceCsv(headers, {
    id: "0090000011",
    invoiceDate: "2026-11-04",
    supplyDate: "2026-11-04",
    buyerTin: "102345678",
    buyerName: "Buyer, Ltd",
    netAmount: "1500.50",
    vatAmount: "270.00",
    branchId: 7,
  });
  assert.match(csv, /^header\.erp_reference,header\.invoice_date/);
  assert.match(csv, /"Buyer, Ltd"/);
  assert.equal(
    invoiceObjectKey({
      organizationId: 101,
      legalEntityId: 202,
      branchId: 7,
      erpCode: "s4hana",
      invoiceId: "0090000011",
    }),
    "uploads/101/202/7/inbound/poll-s4hana-0090000011.csv",
  );
});

test("numeric invoice ids compare by value", () => {
  assert.equal(compareInvoiceId("009", "10"), -1);
  assert.equal(buyerTin("102345678", "1"), "102345678");
});

test("pages follow the next link and save the pointer after each full page", async () => {
  const saved: string[] = [];
  const written: string[] = [];
  const first = Array.from({ length: 100 }, (_, index) => {
    const id = String(index + 1).padStart(10, "0");
    return index === 0 ? { ...document(id), BillingDocumentIsCancelled: "X" } : document(id);
  });
  await pollBillingDocuments({
    endpoint: "https://sap.example/sap/opu/odata/sap/API_BILLING_DOCUMENT_SRV",
    apiKey: "secret",
    lastInvoiceId: null,
    branches,
    fetchPage: async (url, init) => {
      assert.equal(new Headers(init.headers).get("APIKey"), "secret");
      const body = url.startsWith("https://sap.example/page-2")
        ? { value: [document("0000000101")] }
        : { d: { results: first, __next: "https://sap.example/page-2" } };
      return new Response(JSON.stringify(body), { status: 200 });
    },
    write: async (invoice) => {
      written.push(invoice.id);
    },
    savePointer: async (invoiceId) => {
      saved.push(invoiceId);
    },
  });
  assert.equal(written[0], "0000000002");
  assert.equal(written.at(-1), "0000000101");
  assert.equal(written.includes("0000000001"), false);
  assert.deepEqual(saved, ["0000000100", "0000000101"]);
});

test("a bad document does not move the pointer", async () => {
  const saved: string[] = [];
  await assert.rejects(
    pollBillingDocuments({
      endpoint: "https://sap.example/svc",
      apiKey: "secret",
      lastInvoiceId: "0090000001",
      branches,
      fetchPage: async () =>
        new Response(
          JSON.stringify({
            value: [document("0090000002"), { ...document("0090000003"), VATRegistration: "" }],
          }),
          { status: 200 },
        ),
      write: async () => undefined,
      savePointer: async (invoiceId) => {
        saved.push(invoiceId);
      },
    }),
  );
  assert.deepEqual(saved, []);
});

test("next page on another host is refused", () => {
  assert.throws(() => sameOrigin("https://evil.example/next", "https://sap.example/svc"));
});

function document(id: string): Record<string, unknown> {
  return {
    BillingDocument: id,
    BillingDocumentDate: "2026-11-04T00:00:00",
    VATRegistration: "102345678",
    SoldToPartyName: "Buyer",
    TotalNetAmount: "10.00",
    TaxAmount: "1.80",
    CompanyCode: "1000",
  };
}
