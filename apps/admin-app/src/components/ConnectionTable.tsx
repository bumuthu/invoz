import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import type { ConnectionRow } from "@/lib/types";

export default function ConnectionTable({
  rows,
  showOrganization,
}: {
  rows: ConnectionRow[];
  showOrganization: boolean;
}) {
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          {showOrganization ? <TableCell>Organization</TableCell> : null}
          <TableCell>Legal entity</TableCell>
          <TableCell>TIN</TableCell>
          <TableCell>RAMIS</TableCell>
          <TableCell>Certificate</TableCell>
          <TableCell>Mode</TableCell>
          <TableCell>ERP</TableCell>
          <TableCell>Status</TableCell>
          <TableCell>Last polled</TableCell>
          <TableCell>Last error</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={showOrganization ? 10 : 9}>No legal entities yet.</TableCell>
          </TableRow>
        ) : (
          rows.map((row, index) => (
            <TableRow key={`${row.legalEntityId}-${row.erp ?? "none"}-${row.mode ?? "none"}-${index}`} hover>
              {showOrganization ? (
                <TableCell>
                  {row.organization}
                  <br />
                  {row.slug}
                </TableCell>
              ) : null}
              <TableCell>{row.legalEntity}</TableCell>
              <TableCell>{row.tin}</TableCell>
              <TableCell>
                <Chip size="small" label={row.ramisEnabled ? "Enabled" : "Off"} color={row.ramisEnabled ? "success" : "default"} />
              </TableCell>
              <TableCell>{row.certificateOnFile ? "On file" : "None"}</TableCell>
              <TableCell>{row.mode ?? "—"}</TableCell>
              <TableCell>
                {row.erp ?? "—"}
                {row.label ? ` · ${row.label}` : ""}
              </TableCell>
              <TableCell>{row.status ?? "—"}</TableCell>
              <TableCell>{row.lastPolled ? new Date(row.lastPolled).toLocaleString() : "—"}</TableCell>
              <TableCell>{row.lastError ?? "—"}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
