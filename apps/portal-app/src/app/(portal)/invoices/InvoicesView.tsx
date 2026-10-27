"use client";

import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import InvoiceTable from "@/components/InvoiceTable";
import PageHeader from "@/components/PageHeader";
import type { Invoice } from "@/lib/types";

export default function InvoicesView({ invoices }: { invoices: Invoice[] }) {
  return (
    <>
      <PageHeader
        title="Invoices"
        description="Schedule 01 tax invoices and Schedule 04 credit and debit notes."
      />
      <Card>
        {invoices.length === 0 ? (
          <Typography color="text.secondary" sx={{ px: 2.5, py: 2 }}>
            No documents in this view.
          </Typography>
        ) : (
          <InvoiceTable rows={invoices} />
        )}
      </Card>
    </>
  );
}
