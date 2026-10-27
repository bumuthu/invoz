import Card from "@mui/material/Card";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import PageHeader from "@/components/PageHeader";
import { loadPortal } from "@/lib/portal";

export default async function IngestionPage() {
  const portal = await loadPortal();
  const counts = [
    ["Cleared", portal.pipeline.cleared],
    ["Queued", portal.pipeline.submitting],
    ["Rejected", portal.pipeline.rejected],
    ["Skipped", portal.pipeline.skipped],
  ] as const;

  return (
    <>
      <PageHeader
        title="Ingestion"
        description="Document status for this view. This is the portal record, not a live folder monitor."
      />
      <Card sx={{ mb: 3 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Status</TableCell>
              <TableCell>Documents</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {counts.map(([label, count]) => (
              <TableRow key={label}>
                <TableCell>{label}</TableCell>
                <TableCell>{count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      {portal.canAudit ? (
        <>
          <Typography sx={{ fontWeight: 600, mb: 1.5 }}>Recent events</Typography>
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
                  {portal.auditEvents.slice(0, 8).map((event) => (
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
      ) : null}
    </>
  );
}
