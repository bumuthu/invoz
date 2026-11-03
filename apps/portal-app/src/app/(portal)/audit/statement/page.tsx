"use client";

import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import PageData from "@/components/PageData";
import PageHeader from "@/components/PageHeader";
import PrintButton from "@/components/PrintButton";
import { describePeriod } from "@/lib/documents";
import { fetchStatement } from "@/lib/portal-actions";

export default function StatementPage() {
  return (
    <PageData load={fetchStatement}>
      {(portal) => <StatementBody portal={portal} />}
    </PageData>
  );
}

function StatementBody({ portal }: { portal: Awaited<ReturnType<typeof fetchStatement>> }) {
  const issued = new Date().toISOString().slice(0, 10);
  if (!portal.canAudit) {
    return (
      <PageHeader
        title="Continuity statement"
        description="Sequence gaps are available to owners, admins, managers, and viewers."
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Continuity statement"
        description={`${portal.organization.name} · ${describePeriod(portal.filters.period)} · issued ${issued}.`}
        action={<PrintButton />}
      />
      <Stack spacing={1.5}>
        {portal.gaps.length === 0 ? (
          <Typography color="text.secondary">No gazette serials in this view.</Typography>
        ) : (
          portal.gaps.map((gap) => (
            <Card key={`${gap.period}-${gap.branch}`}>
              <CardContent>
                <Typography sx={{ fontWeight: 700 }}>
                  {gap.period} · {gap.branch}
                </Typography>
                <Typography sx={{ mt: 1 }}>
                  {gap.missing.length === 0
                    ? `Serials ${gap.from} through ${gap.to} are continuous (${gap.issued} issued).`
                    : `Serials ${gap.from} through ${gap.to} are missing ${gap.missing.join(", ")}.`}
                </Typography>
              </CardContent>
            </Card>
          ))
        )}
      </Stack>
    </>
  );
}
