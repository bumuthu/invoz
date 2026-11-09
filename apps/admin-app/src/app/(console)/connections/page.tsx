"use client";

import Card from "@mui/material/Card";
import ConnectionTable from "@/components/ConnectionTable";
import LoadState from "@/components/LoadState";
import PageHeader from "@/components/PageHeader";
import { fetchConnections } from "@/lib/client";

export default function ConnectionsPage() {
  return (
    <LoadState loadKey="connections" load={fetchConnections}>
      {(rows) => (
        <>
          <PageHeader
            title="Connections"
            description="RAMIS is per legal entity. ERP connections belong to the organization, so a legal entity repeats once for each connection."
          />
          <Card sx={{ overflow: "auto" }}>
            <ConnectionTable rows={rows} showOrganization />
          </Card>
        </>
      )}
    </LoadState>
  );
}
