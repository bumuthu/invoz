import QRCode from "qrcode";
import InvoiceDetail from "./InvoiceDetail";
import { loadPortal } from "@/lib/portal";

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const portal = await loadPortal();
  const invoice =
    portal.invoices.find((item) => item.id === id) ??
    portal.rejected.find((item) => item.id === id) ??
    portal.recent.find((item) => item.id === id) ??
    null;
  const qr = invoice?.token
    ? await QRCode.toString(`${invoice.serial}|${invoice.token}`, { type: "svg", margin: 1, width: 148 })
    : null;

  return (
    <InvoiceDetail
      invoice={invoice}
      qr={qr}
      organizationId={portal.organization.id}
      canRequeue={portal.canRequeue}
    />
  );
}
