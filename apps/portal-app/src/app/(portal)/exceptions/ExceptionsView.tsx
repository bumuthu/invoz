"use client";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Drawer from "@mui/material/Drawer";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import RequeueButton from "@/components/RequeueButton";
import type { Invoice } from "@/lib/types";

export default function ExceptionsView({
  invoices,
  organizationId,
  canRequeue,
}: {
  invoices: Invoice[];
  organizationId: string;
  canRequeue: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const selected = invoices.find((invoice) => invoice.id === openId) ?? null;
  const facts = selected
    ? [
        ["Buyer", selected.buyer],
        ["Buyer TIN", selected.buyerTin || "—"],
        ["Invoice date", selected.invoiceDate],
        ["Supply date", selected.supplyDate],
        ["Net", selected.amount],
        ["VAT", selected.vat],
        ["Total", selected.total],
        ["Branch", selected.branch],
        ["Document", selected.kind],
      ]
    : [];

  return (
    <>
      <PageHeader
        title="Exceptions"
        description="Rejected documents. Open a row to compare the stored fields with the failure, then re-queue it."
      />
      <Card>
        {invoices.length === 0 ? (
          <Typography color="text.secondary" sx={{ px: 2.5, py: 2 }}>
            No rejected documents in this view.
          </Typography>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Serial</TableCell>
                <TableCell>Buyer</TableCell>
                <TableCell>Failure</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id} hover sx={{ cursor: "pointer" }} onClick={() => setOpenId(invoice.id)}>
                  <TableCell>
                    <Typography sx={{ fontWeight: 600 }}>{invoice.serial}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {invoice.kind}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {invoice.buyer}
                    <Typography variant="caption" display="block" color="text.secondary">
                      {invoice.buyerTin}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", gap: 0.75 }}>
                      {(invoice.tags.length > 0 ? invoice.tags : [invoice.note ?? "Rejected"]).map((tag) => (
                        <Chip key={tag} label={tag} size="small" color="error" />
                      ))}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      <Drawer anchor="right" open={Boolean(selected)} onClose={() => setOpenId(null)}>
        {selected ? (
          <Box sx={{ width: { xs: "100vw", sm: 420 }, p: 3 }}>
            <Typography variant="h6">{selected.serial}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
              Stored fields beside the validation failure.
            </Typography>
            <Stack spacing={1.25} sx={{ mb: 2 }}>
              {facts.map(([label, value]) => (
                <Stack key={label} direction="row" sx={{ justifyContent: "space-between", gap: 2 }}>
                  <Typography color="text.secondary">{label}</Typography>
                  <Typography sx={{ fontWeight: 600, textAlign: "right" }}>{value}</Typography>
                </Stack>
              ))}
            </Stack>
            <Typography sx={{ fontWeight: 600, mb: 1 }}>Failure</Typography>
            <Typography variant="body2" sx={{ mb: 1.5 }}>
              {selected.note ?? "Rejected without a stored message."}
            </Typography>
            <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", gap: 0.75 }}>
              {selected.tags.map((tag) => (
                <Chip key={tag} label={tag} size="small" color="error" />
              ))}
            </Stack>
            {canRequeue ? (
              <RequeueButton organizationId={organizationId} source={selected.source} sourceId={selected.sourceId} />
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Your role can view this exception and cannot re-queue it.
              </Typography>
            )}
          </Box>
        ) : null}
      </Drawer>
    </>
  );
}
