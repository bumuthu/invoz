"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import StatusChip from "@/components/StatusChip";
import type { Invoice } from "@/lib/types";

export default function InvoiceDetail({ invoice }: { invoice: Invoice | null }) {

  if (!invoice) {
    return (
      <PageHeader
        title="Invoice not found"
        description="This document is not in the current queue."
      />
    );
  }

  const facts = [
    ["Buyer", invoice.buyer],
    ["Buyer TIN", invoice.buyerTin],
    ["Invoice date", invoice.invoiceDate],
    ["Supply date", invoice.supplyDate],
    ["Branch", invoice.branch],
    ["Legal entity", invoice.entity],
    ["Net and VAT", `${invoice.amount} · VAT ${invoice.vat}`],
    ["Document", invoice.kind],
  ];

  return (
    <>
      <PageHeader
        title={invoice.serial}
        description={`${invoice.kind} for ${invoice.buyer}.`}
        action={<StatusChip status={invoice.status} />}
      />
      {invoice.note ? (
        <Alert severity={invoice.status === "Rejected" ? "error" : "info"} sx={{ mb: 2.5 }}>
          {invoice.note}
        </Alert>
      ) : null}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1.4fr 0.8fr" },
          gap: 2,
        }}
      >
        <Card>
          <CardContent>
            <Stack spacing={1.75}>
              {facts.map(([label, value]) => (
                <Stack key={label} direction="row" sx={{ justifyContent: "space-between", gap: 2 }}>
                  <Typography color="text.secondary">{label}</Typography>
                  <Typography sx={{ fontWeight: 600, textAlign: "right" }}>{value}</Typography>
                </Stack>
              ))}
            </Stack>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography sx={{ fontWeight: 600, mb: 1.5 }}>Path</Typography>
            <Stack spacing={1.5}>
              <Typography variant="body2">ERP file received for {invoice.branch}.</Typography>
              <Typography variant="body2">Validation and serial {invoice.serial} assigned.</Typography>
              <Typography variant="body2">
                {invoice.status === "Cleared"
                  ? "RAMIS returned a clearance token."
                  : invoice.status === "Rejected"
                    ? "RAMIS was not called. Fix the file and re-queue it."
                    : invoice.status === "Skipped"
                      ? "Marked skipped. RAMIS was not called."
                      : "Queued for the invoice engine."}
              </Typography>
            </Stack>
            {invoice.status === "Rejected" ? (
              <Button variant="contained" sx={{ mt: 2.5 }}>
                Re-queue
              </Button>
            ) : (
              <Button component={Link} href="/invoices" sx={{ mt: 2.5 }}>
                Back to invoices
              </Button>
            )}
          </CardContent>
        </Card>
      </Box>
    </>
  );
}
