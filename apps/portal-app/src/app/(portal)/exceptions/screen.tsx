"use client";

import PageData from "@/components/PageData";
import { fetchExceptions } from "@/lib/portal-client";
import ExceptionsView from "./ExceptionsView";

export default function ExceptionsPage() {
  return (
    <PageData load={fetchExceptions}>
      {(portal) => (
        <ExceptionsView
          invoices={portal.rejected}
          organizationId={portal.organization.id}
          canRequeue={portal.canRequeue}
        />
      )}
    </PageData>
  );
}
