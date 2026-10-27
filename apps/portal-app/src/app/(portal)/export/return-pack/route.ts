import { loadPortal } from "@/lib/portal";

function cell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

function line(values: string[]): string {
  return values.map(cell).join(",");
}

export async function GET() {
  const portal = await loadPortal();
  const header = ["schedule", "entity", "serial", "party", "tin", "date", "net", "vat", "total", "status"];
  const rows = [
    line(header),
    ...portal.invoices.map((invoice) =>
      line([
        invoice.schedule,
        invoice.entity,
        invoice.serial,
        invoice.buyer,
        invoice.buyerTin,
        invoice.invoiceDate,
        invoice.amount,
        invoice.vat,
        invoice.total,
        invoice.status,
      ]),
    ),
    ...portal.scheduleRows.map((row) =>
      line([
        "02",
        row.entity,
        row.serial,
        row.supplier,
        row.tin,
        row.invoiceDate,
        row.amount,
        row.vat,
        "",
        row.approved ? "Approved" : row.match,
      ]),
    ),
  ];

  return new Response(rows.join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=return-pack.csv",
    },
  });
}
