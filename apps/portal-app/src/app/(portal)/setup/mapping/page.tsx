"use client";

import PageData from "@/components/PageData";
import { fetchMapping } from "@/lib/portal-client";
import MappingView from "./MappingView";

export default function MappingPage() {
  return (
    <PageData load={fetchMapping}>
      {(portal) => (
        <MappingView
          connection={portal.erpConnection}
          rows={portal.scheduleMaps}
          entitySelected={portal.filters.entityId !== "all"}
        />
      )}
    </PageData>
  );
}
