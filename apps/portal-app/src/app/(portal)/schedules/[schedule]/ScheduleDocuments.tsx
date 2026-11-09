"use client";

import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import InvoiceTable from "@/components/InvoiceTable";
import PageHeader from "@/components/PageHeader";
import ScheduleDownload from "@/components/ScheduleDownload";
import type { Invoice } from "@/lib/types";

export default function ScheduleDocuments({
  title,
  description,
  schedule,
  invoices,
}: {
  title: string;
  description: string;
  schedule: string;
  invoices: Invoice[];
}) {
  return (
    <>
      <PageHeader title={title} description={description} action={<ScheduleDownload schedule={schedule} />} />
      <Card>
        {invoices.length === 0 ? (
          <Typography color="text.secondary" sx={{ px: 2.5, py: 2 }}>
            No documents in this period.
          </Typography>
        ) : (
          <InvoiceTable rows={invoices} showDate />
        )}
      </Card>
    </>
  );
}
