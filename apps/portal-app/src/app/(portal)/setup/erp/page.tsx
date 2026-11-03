import ErpView from "./ErpView";
import { loadPortal } from "@/lib/portal";

export default async function ErpPage() {
  const portal = await loadPortal();
  return (
    <ErpView
      catalog={portal.erpCatalog}
      connections={portal.erpConnections}
      connection={portal.erpConnection}
      organizationId={portal.organization.id}
      entityId={portal.filters.entityId === "all" ? null : portal.filters.entityId}
      canConnect={portal.canMap}
    />
  );
}
