"use client";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { useState } from "react";
import { formatCount } from "@/components/Counts";
import LoadState from "@/components/LoadState";
import PageHeader from "@/components/PageHeader";
import { fetchOverview } from "@/lib/client";
import type { Range, StatusCounts } from "@/lib/types";

const periodFieldSx = {
  width: { xs: "100%", sm: 280 },
  "& .MuiInputLabel-root": { fontSize: 13, fontWeight: 600 },
  "& .MuiInputBase-root": { fontSize: 13, fontWeight: 600, letterSpacing: "-0.011em" },
  "& .MuiSelect-select": { fontWeight: 600, py: "7.5px" },
};

export default function OverviewPage() {
  const [range, setRange] = useState<Range>("month");
  const monthLabel = currentMonthLabel();
  return (
    <LoadState loadKey={range} load={() => fetchOverview(range)}>
      {(overview) => (
        <Stack spacing={2.5}>
          <PageHeader
            title="Overview"
            description="Accepted invoices are cleared. Rejected invoices were refused by RAMIS."
          />
          <Stack
            direction={{ xs: "column", sm: "row" }}
            sx={{
              alignItems: "stretch",
              border: 1,
              borderColor: "divider",
              borderRadius: 3,
              bgcolor: "background.paper",
              px: 2.25,
              py: 2,
            }}
          >
            <TextField
              select
              size="small"
              label="Taxable period"
              value={range}
              onChange={(event) => setRange(event.target.value as Range)}
              sx={periodFieldSx}
            >
              <MenuItem value="month">{monthLabel}</MenuItem>
              <MenuItem value="all">All time</MenuItem>
            </TextField>
          </Stack>
          <TotalsCard counts={overview.totals} period={range === "all" ? "All time" : monthLabel} />
          <Card>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Organization</TableCell>
                  <TableCell>Accepted</TableCell>
                  <TableCell>Rejected</TableCell>
                  <TableCell>Total</TableCell>
                  <TableCell>Allowance used</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {overview.organizations.map((organization) => (
                  <TableRow key={organization.id} hover>
                    <TableCell>
                      <Link href={`/organizations/${organization.id}`}>{organization.name}</Link>
                      <Typography variant="caption" display="block" color="text.secondary">
                        {organization.slug}
                      </Typography>
                    </TableCell>
                    <TableCell>{formatCount(organization.counts.cleared)}</TableCell>
                    <TableCell>{formatCount(organization.counts.rejected)}</TableCell>
                    <TableCell>{formatCount(organization.counts.total)}</TableCell>
                    <TableCell>
                      {formatCount(organization.used)} / {formatCount(organization.allowance)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </Stack>
      )}
    </LoadState>
  );
}

function TotalsCard({ counts, period }: { counts: StatusCounts; period: string }) {
  const cells = [
    { label: "Accepted", value: counts.cleared },
    { label: "Rejected", value: counts.rejected },
    { label: "Queued", value: counts.queued },
    { label: "Validated", value: counts.validated },
    { label: "Draft", value: counts.draft },
    { label: "Skipped", value: counts.skipped_non_vat },
    { label: "Total", value: counts.total },
  ];
  return (
    <Card>
      <Stack direction="row" spacing={1} sx={{ px: 2, py: 1.25, alignItems: "baseline", borderBottom: 1, borderColor: "divider" }}>
        <Typography sx={{ fontWeight: 600 }}>All organizations</Typography>
        <Typography variant="body2" color="text.secondary">
          {period}
        </Typography>
      </Stack>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(4, 1fr)", lg: "repeat(7, 1fr)" },
        }}
      >
        {cells.map((cell, index) => (
          <Box
            key={cell.label}
            sx={{
              px: 2,
              py: 1.25,
              borderRight: { lg: index < cells.length - 1 ? 1 : 0 },
              borderBottom: {
                xs: index < cells.length - (cells.length % 2 || 2) ? 1 : 0,
                sm: index < 4 ? 1 : 0,
                lg: 0,
              },
              borderColor: "divider",
            }}
          >
            <Typography variant="caption" color="text.secondary">
              {cell.label}
            </Typography>
            <Typography sx={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.2 }}>
              {formatCount(cell.value)}
            </Typography>
          </Box>
        ))}
      </Box>
    </Card>
  );
}

function currentMonthLabel() {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Colombo",
    month: "long",
    year: "numeric",
  }).format(new Date());
}
