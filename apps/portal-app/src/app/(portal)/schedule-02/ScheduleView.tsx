"use client";

import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Checkbox from "@mui/material/Checkbox";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import type { ScheduleRow } from "@/lib/types";

export default function ScheduleView({ rows }: { rows: ScheduleRow[] }) {
  const [selected, setSelected] = useState<string[]>(() =>
    rows.filter((row) => row.matched !== "Unmatched").map((row) => row.id),
  );

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  return (
    <>
      <PageHeader
        title="Schedule 02"
        description="Supplier invoices posted to this legal entity. Approve matched records to claim input VAT."
        action={
          <Button variant="contained" disabled={selected.length === 0}>
            Approve {selected.length} selected
          </Button>
        }
      />
      <Card>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox" />
              <TableCell>Supplier</TableCell>
              <TableCell>Serial</TableCell>
              <TableCell>VAT</TableCell>
              <TableCell>Purchase match</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} hover>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={selected.includes(row.id)}
                    onChange={() => toggle(row.id)}
                    inputProps={{ "aria-label": `Select ${row.supplier}` }}
                  />
                </TableCell>
                <TableCell>
                  {row.supplier}
                  <br />
                  {row.tin}
                </TableCell>
                <TableCell>{row.serial}</TableCell>
                <TableCell>{row.vat}</TableCell>
                <TableCell>{row.matched}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
