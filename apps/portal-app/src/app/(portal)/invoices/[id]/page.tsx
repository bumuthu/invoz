"use client";

import { useParams } from "next/navigation";
import { useCallback } from "react";
import PageData from "@/components/PageData";
import { fetchInvoice } from "@/lib/portal-actions";
import InvoiceDetail from "./InvoiceDetail";

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const load = useCallback((search: string) => fetchInvoice(id, search), [id]);
  return (
    <PageData load={load}>
      {(portal) => (
        <InvoiceDetail
          invoice={portal.invoice}
          qr={portal.qr}
          organizationId={portal.organization.id}
          canRequeue={portal.canRequeue}
        />
      )}
    </PageData>
  );
}
