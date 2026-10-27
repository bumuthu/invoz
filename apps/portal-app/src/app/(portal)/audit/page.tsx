import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { loadPortal } from "@/lib/portal";

export default async function AuditPage() {
  const portal = await loadPortal();
  if (!portal.canAudit) {
    return (
      <PageHeader
        title="Audit"
        description="Sequence gaps and the audit log are available to owners, admins, managers, and viewers."
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Audit"
        description="Gazette serials in this view, and the latest audit events."
        action={
          <Button component={Link} href={`/audit/statement${portal.query}`} variant="outlined">
            Continuity statement
          </Button>
        }
      />
      <Typography sx={{ fontWeight: 600, mb: 1.5 }}>Sequence gaps</Typography>
      <Card sx={{ mb: 3 }}>
        {portal.gaps.length === 0 ? (
          <Typography color="text.secondary" sx={{ px: 2.5, py: 2 }}>
            No gazette serials in this view.
          </Typography>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Period</TableCell>
                <TableCell>Branch</TableCell>
                <TableCell>Issued</TableCell>
                <TableCell>Range</TableCell>
                <TableCell>Missing</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {portal.gaps.map((gap) => (
                <TableRow key={`${gap.period}-${gap.branch}`}>
                  <TableCell>{gap.period}</TableCell>
                  <TableCell>{gap.branch}</TableCell>
                  <TableCell>{gap.issued}</TableCell>
                  <TableCell>
                    {gap.from}–{gap.to}
                  </TableCell>
                  <TableCell>{gap.missing.length === 0 ? "Continuous" : gap.missing.join(", ")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      <Typography sx={{ fontWeight: 600, mb: 1.5 }}>Audit log</Typography>
      <Card>
        {portal.auditEvents.length === 0 ? (
          <Typography color="text.secondary" sx={{ px: 2.5, py: 2 }}>
            No audit events in this view.
          </Typography>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>When</TableCell>
                <TableCell>Event</TableCell>
                <TableCell>Document</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {portal.auditEvents.map((event) => (
                <TableRow key={event.id}>
                  <TableCell>{event.at}</TableCell>
                  <TableCell>{event.event}</TableCell>
                  <TableCell>{event.document}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  );
}
