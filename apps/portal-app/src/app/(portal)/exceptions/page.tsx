import ExceptionsView from "./ExceptionsView";
import { loadPortal } from "@/lib/portal";

export default async function ExceptionsPage() {
  const portal = await loadPortal();
  return (
    <ExceptionsView
      invoices={portal.rejected}
      organizationId={portal.organization.id}
      canRequeue={portal.canRequeue}
    />
  );
}
