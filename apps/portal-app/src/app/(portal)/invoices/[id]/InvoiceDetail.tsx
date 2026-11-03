"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import CorrectDocument from "@/components/CorrectDocument";
import PageHeader from "@/components/PageHeader";
import StatusChip from "@/components/StatusChip";
import type { Invoice } from "@/lib/types";

export default function InvoiceDetail({
  invoice,
  qr,
  organizationId,
  canRequeue,
}: {
  invoice: Invoice | null;
  qr: string | null;
  organizationId: string;
  canRequeue: boolean;
}) {
  if (!invoice) {
    return (
      <PageHeader title="Invoice not found" description="This document is not in the current view." />
    );
  }

  const facts = [
    ["Buyer", invoice.buyer],
    ["Buyer TIN", invoice.buyerTin || "—"],
    ["Invoice date", invoice.invoiceDate],
    ["Supply date", invoice.supplyDate],
    ["Branch", invoice.branch],
    ["Legal entity", invoice.entity],
    ["Net", invoice.amount],
    ["VAT", invoice.vat],
    ["Total", invoice.total],
    ["Document", invoice.kind],
    ...(invoice.parentSerial ? [["Original serial", invoice.parentSerial] as const] : []),
    ...(invoice.parentDate ? [["Original date", invoice.parentDate] as const] : []),
    ...(invoice.reason ? [["Reason", invoice.reason] as const] : []),
    ["Clearance token", invoice.token ?? "No clearance token stored"],
  ];

  return (
    <>
      <PageHeader
        title={invoice.serial}
        description={`${invoice.kind} for ${invoice.buyer}. Cleared documents stay locked.`}
        action={<StatusChip status={invoice.status} />}
      />
      {invoice.note ? (
        <Alert severity={invoice.status === "Rejected" ? "error" : "info"} sx={{ mb: 2.5 }}>
          {invoice.note}
        </Alert>
      ) : null}
      {invoice.tags.length > 0 ? (
        <Stack direction="row" spacing={1} sx={{ mb: 2.5, flexWrap: "wrap", gap: 1 }}>
          {invoice.tags.map((tag) => (
            <Chip key={tag} label={tag} size="small" color={invoice.status === "Rejected" ? "error" : "default"} />
          ))}
        </Stack>
      ) : null}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.4fr 0.8fr" }, gap: 2 }}>
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
            <Typography sx={{ fontWeight: 600, mb: 1.5 }}>Verification</Typography>
            {qr ? (
              <Box
                sx={{
                  width: 148,
                  color: "text.primary",
                  "& svg": { display: "block", width: "100%", height: "auto" },
                }}
                dangerouslySetInnerHTML={{ __html: qr }}
              />
            ) : (
              <Typography variant="body2" color="text.secondary">
                A QR code appears after RAMIS stores a clearance token.
              </Typography>
            )}
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              {invoice.status === "Cleared"
                ? "This document is cleared and cannot be edited or re-queued."
                : invoice.status === "Rejected"
                  ? "Correct the fields below and resubmit this document. Serial, legal entity, and branch stay locked."
                  : invoice.status === "Skipped"
                    ? "Marked skipped. RAMIS was not called."
                    : "Queued for the invoice engine."}
            </Typography>
            {invoice.status === "Rejected" && canRequeue ? (
              <CorrectDocument invoice={invoice} organizationId={organizationId} />
            ) : (
              <Button
                component={Link}
                href={invoice.schedule === "04" ? "/schedules/04" : invoice.schedule === "07" ? "/schedules/07" : "/schedules/01"}
                sx={{ mt: 2.5 }}
              >
                Back to schedule
              </Button>
            )}
          </CardContent>
        </Card>
      </Box>
    </>
  );
}
