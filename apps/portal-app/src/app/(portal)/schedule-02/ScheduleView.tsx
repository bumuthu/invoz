"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { approveInbound } from "@/lib/actions";
import type { ScheduleRow } from "@/lib/types";

const matchLabel = {
  matched: "Matched",
  discrepancy: "Discrepancy",
  unmatched: "Unmatched",
} as const;

const matchColor = {
  matched: "success",
  discrepancy: "warning",
  unmatched: "default",
} as const;

export default function ScheduleView({
  rows,
  organizationId,
  canApprove,
  hiddenBySchedule,
}: {
  rows: ScheduleRow[];
  organizationId: string;
  canApprove: boolean;
  hiddenBySchedule: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  return (
    <>
      <PageHeader
        title="Schedule 02"
        description="Supplier bills beside the ERP voucher reference. Approve up to 5,000 records."
        action={
          canApprove ? (
            <Button
              variant="contained"
              disabled={pending || selected.length === 0 || selected.length > 5000}
              onClick={async () => {
                setPending(true);
                const result = await approveInbound(organizationId, selected);
                setPending(false);
                if (!result.ok) {
                  setMessage({ tone: "error", text: result.error });
                  return;
                }
                setSelected([]);
                setMessage({ tone: "success", text: result.message });
                router.refresh();
              }}
            >
              Approve {selected.length} selected
            </Button>
          ) : (
            <Typography variant="body2" color="text.secondary">
              View only
            </Typography>
          )
        }
      />
      {message ? (
        <Alert severity={message.tone} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      ) : null}
      {selected.length > 5000 ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Select at most 5,000 records.
        </Alert>
      ) : null}
      {hiddenBySchedule ? (
        <Typography color="text.secondary">This schedule is hidden by the schedule filter.</Typography>
      ) : rows.length === 0 ? (
        <Typography color="text.secondary">No purchases in this view.</Typography>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.15fr 0.85fr" }, gap: 2 }}>
          <Card>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" />
                  <TableCell>Supplier</TableCell>
                  <TableCell>Serial</TableCell>
                  <TableCell>VAT</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selected.includes(row.id)}
                        onChange={() => toggle(row.id)}
                        disabled={row.approved}
                        inputProps={{ "aria-label": `Select ${row.supplier}` }}
                      />
                    </TableCell>
                    <TableCell>
                      {row.supplier}
                      <Typography variant="caption" display="block" color="text.secondary">
                        {row.tin}
                        {row.approved ? " · Approved" : ""}
                      </Typography>
                    </TableCell>
                    <TableCell>{row.serial}</TableCell>
                    <TableCell>{row.vat}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          <Card>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ERP voucher</TableCell>
                  <TableCell>Match</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>{row.voucher ?? "No ERP voucher"}</TableCell>
                    <TableCell>
                      <Chip label={matchLabel[row.match]} size="small" color={matchColor[row.match]} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </Box>
      )}
    </>
  );
}
