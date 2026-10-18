import InvoicesView from "./InvoicesView";
import { loadPortal } from "@/lib/portal";

export default async function InvoicesPage() {
  const portal = await loadPortal();
  return <InvoicesView invoices={portal.invoices} />;
}
