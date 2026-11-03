"use client";

import PageData from "@/components/PageData";
import { fetchErp } from "@/lib/portal-client";
import ErpView from "./ErpView";

export default function ErpPage() {
  return (
    <PageData load={fetchErp}>
      {(portal) => (
        <ErpView
          catalog={portal.erpCatalog}
          connections={portal.erpConnections}
          connection={portal.erpConnection}
          organizationId={portal.organization.id}
          entityId={portal.filters.entityId === "all" ? null : portal.filters.entityId}
          canConnect={portal.canMap}
        />
      )}
    </PageData>
  );
}
