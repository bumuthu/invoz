export type InvoicePayload = ReturnType<typeof sampleInvoice>;

export function sampleInvoice() {
  return {
    header: {
      serial_number: "26OCT_HQ01_1042",
      erp_reference: "SAP-INV-990812",
      invoice_date: "2026-10-18",
      supply_date: "2026-10-17",
      invoice_type: "STANDARD_TAX_INVOICE",
      place_of_supply: "Colombo Distribution Depot",
    },
    supplier: {
      tin: "104829102",
      name: "Lanka Industrial Supplies PLC",
      address: "No. 45, Baseline Road, Colombo 09",
    },
    purchaser: {
      tin: "709182341",
      name: "Ceylon Tea Marketing (Pvt) Ltd",
      address: "No. 12, Galle Road, Colombo 03",
    },
    currency_summary: {
      currency: "LKR",
      exchange_rate: 1,
      total_value_excluding_vat: 1_000_000,
      vat_rate: 18,
      total_vat_amount: 180_000,
      total_consideration_including_vat: 1_180_000,
    },
    line_items: [
      {
        item_sequence: 1,
        description: "Corrugated Export Packaging Cartons 5-Ply",
        quantity: 5000,
        unit_of_measure: "UNITS",
        unit_price: 200,
        line_amount_excluding_vat: 1_000_000,
        vat_rate: 18,
        vat_amount: 180_000,
        line_total_including_vat: 1_180_000,
      },
    ],
  };
}

export function sampleCreditNote(originalSerial = "26OCT_HQ01_1042") {
  return {
    header: {
      adjustment_serial_number: "26OCT_HQ01_CR0012",
      adjustment_type: "TAX_CREDIT_NOTE",
      adjustment_date: "2026-10-19",
      original_invoice_serial_number: originalSerial,
      original_invoice_date: "2026-10-18",
      adjustment_reason: "Damaged goods returned during delivery transit",
    },
    supplier: {
      tin: "104829102",
      name: "Lanka Industrial Supplies PLC",
    },
    purchaser: {
      tin: "709182341",
      name: "Ceylon Tea Marketing (Pvt) Ltd",
    },
    adjustment_values: {
      adjusted_value_excluding_vat: 100_000,
      vat_rate: 18,
      adjusted_vat_amount: 18_000,
      adjusted_total_consideration: 118_000,
    },
  };
}
