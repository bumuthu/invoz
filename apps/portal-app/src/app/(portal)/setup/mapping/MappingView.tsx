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
  connections,
  rows,
  entitySelected,
}: {
  connections: ErpConnectionView[];
  rows: ScheduleMapRow[];
  entitySelected: boolean;
}) {
  const erps = [...new Map(connections.map((item) => [item.code, item])).values()];
  return (
    <>
      <PageHeader
        title="Field mapping"
        description={
          erps.length
            ? "RAMIS paths for each ERP on this organization. This map is read only."
            : "RAMIS paths for the ERPs connected to this organization."
        }
      />
      {!entitySelected ? (
        <Typography color="text.secondary">Select one legal entity to see its field map.</Typography>
      ) : erps.length === 0 ? (
        <Typography color="text.secondary">Add an integration on the ERP tab before viewing its field map.</Typography>
      ) : (
        erps.map((erp) => (
          <Card key={erp.code} sx={{ mb: 2 }}>
            <Typography sx={{ px: 2.5, pt: 2, fontWeight: 700 }}>{erp.name}</Typography>
            {schedules.map((schedule) => {
              const mapped = rows.filter((row) => row.erpCode === erp.code && row.schedule === schedule.code);
              return (
                <Table key={schedule.code}>
                  <TableHead>
                    <TableRow>
                      <TableCell>{schedule.title} ERP field</TableCell>
                      <TableCell>RAMIS field</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {mapped.map((row) => (
                      <TableRow key={`${erp.code}:${row.schedule}:${row.ramisField}`}>
                        <TableCell>{row.erpField}</TableCell>
                        <TableCell>{row.ramisField}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              );
            })}
          </Card>
        ))
      )}
    </>
  );
}
