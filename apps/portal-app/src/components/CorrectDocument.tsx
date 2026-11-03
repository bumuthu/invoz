"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { useState } from "react";
import { correctAndResubmit, reloadPortal } from "@/lib/portal-client";
import type { Invoice } from "@/lib/types";

export default function CorrectDocument({
  invoice,
  organizationId,
}: {
  invoice: Invoice;
  organizationId: string;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const note = invoice.source === "adjustment";
  const [buyerName, setBuyerName] = useState(invoice.buyer);
  const [buyerTin, setBuyerTin] = useState(invoice.buyerTin);
  const [invoiceDate, setInvoiceDate] = useState(invoice.edit.invoiceDate);
  const [supplyDate, setSupplyDate] = useState(invoice.edit.supplyDate);
  const [net, setNet] = useState(invoice.edit.net);
  const [vat, setVat] = useState(invoice.edit.vat);
  const [total, setTotal] = useState(invoice.edit.total);
  const [reason, setReason] = useState(invoice.reason ?? "");
  const [originalSerial, setOriginalSerial] = useState(invoice.parentSerial ?? "");
  const [originalDate, setOriginalDate] = useState(invoice.edit.parentDate);

  return (
    <Stack spacing={1.5} sx={{ mt: 2 }}>
      <TextField label="Buyer name" value={buyerName} onChange={(event) => setBuyerName(event.target.value)} />
      <TextField label="Buyer TIN" value={buyerTin} onChange={(event) => setBuyerTin(event.target.value)} />
      <TextField
        label={note ? "Note date" : "Invoice date"}
        type="date"
        value={invoiceDate}
        onChange={(event) => setInvoiceDate(event.target.value)}
        slotProps={{ inputLabel: { shrink: true } }}
      />
      {note ? null : (
        <TextField
          label="Supply date"
          type="date"
          value={supplyDate}
          onChange={(event) => setSupplyDate(event.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
      )}
      <TextField label={note ? "Adjusted net" : "Net"} value={net} onChange={(event) => setNet(event.target.value)} />
      <TextField label={note ? "Adjusted VAT" : "VAT"} value={vat} onChange={(event) => setVat(event.target.value)} />
      <TextField label={note ? "Adjusted total" : "Total"} value={total} onChange={(event) => setTotal(event.target.value)} />
      {note ? (
        <>
          <TextField label="Reason" value={reason} onChange={(event) => setReason(event.target.value)} />
          <TextField label="Original serial" value={originalSerial} onChange={(event) => setOriginalSerial(event.target.value)} />
          <TextField
            label="Original invoice date"
            type="date"
            value={originalDate}
            onChange={(event) => setOriginalDate(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </>
      ) : null}
      {message ? <Alert severity={message.tone}>{message.text}</Alert> : null}
      <Button
        variant="contained"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          const result = await correctAndResubmit(organizationId, invoice.source, invoice.sourceId, {
            buyerName,
            buyerTin,
            invoiceDate,
            supplyDate,
            net,
            vat,
            total,
            reason,
            originalSerial,
            originalDate,
          });
          setPending(false);
          if (!result.ok) {
            setMessage({ tone: "error", text: result.error });
            reloadPortal();
            return;
          }
          setMessage({ tone: "success", text: result.message });
          reloadPortal();
        }}
      >
        Save and resubmit
      </Button>
    </Stack>
  );
}
