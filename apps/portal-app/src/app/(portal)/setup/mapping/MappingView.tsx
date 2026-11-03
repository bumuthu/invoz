"use client";

import Card from "@mui/material/Card";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import PageHeader from "@/components/PageHeader";
import type { ErpConnectionView, ScheduleMapRow } from "@/lib/types";

const schedules = [
  { code: "01", title: "Schedule 01" },
  { code: "04", title: "Schedule 04" },
  { code: "07", title: "Schedule 07" },
] as const;

export default function MappingView({
  connection,
  rows,
  entitySelected,
}: {
  connection: ErpConnectionView | null;
  rows: ScheduleMapRow[];
  entitySelected: boolean;
}) {
  return (
    <>
      <PageHeader
        title="Field mapping"
        description={
          connection
            ? `${connection.name} fields beside the RAMIS paths. This map is read only.`
            : "RAMIS paths for the ERP connected to the selected legal entity."
        }
      />
      {!entitySelected ? (
        <Typography color="text.secondary">Select one legal entity to see its field map.</Typography>
      ) : connection === null ? (
        <Typography color="text.secondary">Connect an ERP on the ERP tab before viewing its field map.</Typography>
      ) : (
        schedules.map((schedule) => {
          const mapped = rows.filter((row) => row.schedule === schedule.code);
          return (
            <Card key={schedule.code} sx={{ mb: 2 }}>
              <Typography sx={{ px: 2.5, pt: 2, fontWeight: 700 }}>{schedule.title}</Typography>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>ERP field</TableCell>
                    <TableCell>RAMIS field</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {mapped.map((row) => (
                    <TableRow key={row.ramisField}>
                      <TableCell>{row.erpField}</TableCell>
                      <TableCell>{row.ramisField}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          );
        })
      )}
    </>
  );
}
