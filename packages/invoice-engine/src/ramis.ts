import { createHash } from "node:crypto";
import type { MappedInvoice } from "./invoices";

export type RamisInvoice = {
  header: {
    serial_number: string;
    erp_reference: string;
    invoice_date: string;
    supply_date: string;
    invoice_type: "STANDARD_TAX_INVOICE" | "EXEMPT";
    place_of_supply: string;
  };
  supplier: { tin: string; name: string; address: string };
  purchaser: { tin: string; name: string; address: string };
  currency_summary: {
    currency: "LKR";
    exchange_rate: number;
    total_value_excluding_vat: number;
    vat_rate: number;
    total_vat_amount: number;
    total_consideration_including_vat: number;
  };
  line_items: [
    {
      item_sequence: 1;
      description: string;
      quantity: number;
      unit_of_measure: "UNITS";
      unit_price: number;
      line_amount_excluding_vat: number;
      vat_rate: number;
      vat_amount: number;
      line_total_including_vat: number;
    },
  ];
};

export type Clearance = {
  token: string;
  clearedAt: string;
  hash: string;
};

export class RamisRejection extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

let tokenCache: { secret: string; token: string; expiresAt: number } | undefined;

export function ramisPayload(
  invoice: MappedInvoice,
  serialNumber: string,
  supplier: { tin: string; name: string },
  placeOfSupply: string,
): RamisInvoice {
  const exempt = Number(invoice.vatAmount) === 0;
  const vatRate = exempt ? 0 : 18;
  const net = Number(invoice.netAmount);
  const vat = Number(invoice.vatAmount);
  const total = Number(invoice.totalAmount);
  return {
    header: {
      serial_number: serialNumber,
      erp_reference: invoice.erpReference,
      invoice_date: invoice.invoiceDate,
      supply_date: invoice.supplyDate,
      invoice_type: exempt ? "EXEMPT" : "STANDARD_TAX_INVOICE",
      place_of_supply: placeOfSupply,
    },
    supplier: { tin: supplier.tin, name: supplier.name, address: placeOfSupply },
    purchaser: { tin: invoice.buyerTin, name: invoice.buyerName, address: invoice.buyerName },
    currency_summary: {
      currency: "LKR",
      exchange_rate: 1,
      total_value_excluding_vat: net,
      vat_rate: vatRate,
      total_vat_amount: vat,
      total_consideration_including_vat: total,
    },
    line_items: [
      {
        item_sequence: 1,
        description: invoice.erpReference,
        quantity: 1,
        unit_of_measure: "UNITS",
        unit_price: net,
        line_amount_excluding_vat: net,
        vat_rate: vatRate,
        vat_amount: vat,
        line_total_including_vat: total,
      },
    ],
  };
}

export function payloadHash(payload: RamisInvoice): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function idempotencyKey(objectKey: string, erpReference: string): string {
  return createHash("sha256").update(`${objectKey}\n${erpReference}`).digest("hex");
}

export async function submitInvoice(
  payload: RamisInvoice,
  idempotency: string,
): Promise<Clearance> {
  const baseUrl = process.env.RAMIS_API_URL?.replace(/\/+$/, "");
  const secret = process.env.RAMIS_CLIENT_SECRET?.trim();
  if (!baseUrl) throw new Error("RAMIS_API_URL is required");
  if (!secret) throw new Error("RAMIS_CLIENT_SECRET is required");

  const token = await accessToken(baseUrl, payload.supplier.tin, secret);
  const requestBody = JSON.stringify(payload);
  console.log("invoice-engine ramis request", requestBody);
  const response = await fetch(`${baseUrl}/api/v1/vat/schedule01/invoices`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-client-tin": payload.supplier.tin,
      "x-idempotency-key": idempotency,
    },
    body: requestBody,
  });
  const responseText = await response.text();
  console.log("invoice-engine ramis response", response.status, responseText);
  const body = (parseJson(responseText) ?? {}) as {
    message?: string;
    ramis_clearance_token?: string;
    cleared_timestamp?: string;
  };
  if (response.status === 200 || response.status === 201) {
    if (!body.ramis_clearance_token || !body.cleared_timestamp) {
      throw new Error("RAMIS response did not include a clearance token");
    }
    return { token: body.ramis_clearance_token, clearedAt: body.cleared_timestamp, hash: payloadHash(payload) };
  }
  const message = body.message || `RAMIS returned HTTP ${response.status}`;
  if (response.status >= 400 && response.status < 500) {
    throw new RamisRejection(response.status, message);
  }
  throw new Error(message);
}

function parseJson(text: string): unknown {
  if (text === "") return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

async function accessToken(baseUrl: string, clientId: string, secret: string): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.secret === secret && tokenCache.expiresAt > now) {
    return tokenCache.token;
  }
  const response = await fetch(`${baseUrl}/oauth/v2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: secret,
    }),
  });
  const body = (await response.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; message?: string };
  if (!response.ok || !body.access_token) {
    throw new Error(body.message || `RAMIS token request failed with HTTP ${response.status}`);
  }
  tokenCache = {
    secret,
    token: body.access_token,
    expiresAt: now + Math.max((body.expires_in ?? 60) - 30, 1) * 1000,
  };
  return body.access_token;
}
