"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import Link from "@mui/material/Link";
import NextLink from "next/link";
import Initials from "@/components/Initials";
import StatusChip from "@/components/StatusChip";
import type { Invoice } from "@/lib/types";

export default function InvoiceTable({ rows }: { rows: Invoice[] }) {
  return (
    <Box sx={{ overflowX: "auto" }}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Serial</TableCell>
            <TableCell>Buyer</TableCell>
            <TableCell>Branch</TableCell>
            <TableCell>Amount</TableCell>
            <TableCell>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((invoice) => (
            <TableRow key={invoice.id} hover>
              <TableCell>
                <Link
                  component={NextLink}
                  href={`/invoices/${invoice.id}`}
                  underline="hover"
                  color="primary"
                  sx={{ fontWeight: 600 }}
                >
                  {invoice.serial}
                </Link>
                <Typography variant="caption" display="block" color="text.secondary">
                  {invoice.kind}
                </Typography>
              </TableCell>
              <TableCell>
                <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
                  <Initials name={invoice.buyer} />
                  <Box>
                    {invoice.buyer}
                    <Typography variant="caption" display="block" color="text.secondary">
                      {invoice.buyerTin}
                    </Typography>
                  </Box>
                </Stack>
              </TableCell>
              <TableCell>{invoice.branch}</TableCell>
              <TableCell>{invoice.amount}</TableCell>
              <TableCell>
                <StatusChip status={invoice.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}
