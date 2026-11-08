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
          entities={portal.entities}
          organizationId={portal.organization.id}
          canConnect={portal.canMap}
          pollingEnabled={portal.pollingEnabled}
        />
      )}
    </PageData>
  );
}
