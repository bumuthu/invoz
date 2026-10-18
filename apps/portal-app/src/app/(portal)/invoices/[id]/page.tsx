import InvoiceDetail from "./InvoiceDetail";
import { loadPortal } from "@/lib/portal";

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const portal = await loadPortal();
  return <InvoiceDetail invoice={portal.invoices.find((invoice) => invoice.id === id) ?? null} />;
}
