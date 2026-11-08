import {
  billingDocumentUrl,
  compareInvoiceId,
  documentId,
  mapBillingDocument,
  maxPages,
  pageSize,
  parseBillingPage,
  sameOrigin,
  type BranchRef,
  type PolledInvoice,
} from "./billing";

export type PageFetcher = (url: string, init: RequestInit) => Promise<Response>;

export async function pollBillingDocuments(input: {
  endpoint: string;
  apiKey: string;
  lastInvoiceId: string | null;
  branches: BranchRef[];
  fetchPage?: PageFetcher;
  write: (invoice: PolledInvoice) => Promise<void>;
  savePointer: (invoiceId: string) => Promise<void>;
}): Promise<void> {
  const fetchPage = input.fetchPage ?? fetch;
  let url: string | null = billingDocumentUrl(input.endpoint, input.lastInvoiceId);

  for (let page = 0; page < maxPages && url; page += 1) {
    const response = await fetchPage(url, {
      headers: { APIKey: input.apiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`SAP billing documents returned ${response.status}: ${body.slice(0, 300)}`);
    }
    const parsed = parseBillingPage(await response.json());
    const documents = [...parsed.documents].sort((left, right) => compareInvoiceId(documentId(left), documentId(right)));
    if (documents.length === 0) return;

    const invoices: PolledInvoice[] = [];
    for (const document of documents) {
      const invoice = mapBillingDocument(document, input.branches);
      if (invoice) invoices.push(invoice);
    }
    for (const invoice of invoices) {
      await input.write(invoice);
    }

    const lastId = documentId(documents[documents.length - 1] ?? {});
    if (!lastId) throw new Error("SAP billing document has no invoice id");
    await input.savePointer(lastId);

    if (documents.length < pageSize || !parsed.nextUrl) return;
    url = sameOrigin(parsed.nextUrl, input.endpoint);
  }
}
