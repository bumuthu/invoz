import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import InvoiceTable from "@/components/InvoiceTable";
import PageHeader from "@/components/PageHeader";
import { loadPortal } from "@/lib/portal";

export default async function OverviewPage() {
  const portal = await loadPortal();
  const { metrics, health, pipeline } = portal;
  const peak = Math.max(...metrics.daily.map((point) => point.count), 1);
  const cards = [
    {
      label: "Net VAT position",
      value: metrics.netVat,
      note: `Output ${metrics.outputVat} · input ${metrics.inputVat} · adjustments ${metrics.adjustmentVat}. Due ${metrics.dueLabel}.`,
    },
    {
      label: "Clearance rate",
      value: metrics.clearanceRate,
      note: `${pipeline.submitting} still in the queue.`,
    },
    {
      label: "Input VAT at risk",
      value: metrics.inputAtRisk,
      note: "Schedule 02 purchases not yet approved.",
    },
    {
      label: "Active exceptions",
      value: String(metrics.rejected),
      note: "Rejected outbound documents in this view.",
    },
  ];

  return (
    <>
      <PageHeader
        title="Overview"
        description={`${portal.organization.name} · cleared output VAT, approved input VAT, and Schedule 04 adjustments.`}
        action={
          <Button component={Link} href={`/export/return-pack${portal.query}`} variant="contained">
            Download return pack
          </Button>
        }
      />
      <Card sx={{ mb: 2.5 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
          {cards.map((card, index) => (
            <Box
              key={card.label}
              sx={{
                px: 2.75,
                py: 2.5,
                borderRight: { md: index % 2 === 0 ? 1 : 0 },
                borderBottom: { xs: index < cards.length - 1 ? 1 : 0, md: index < 2 ? 1 : 0 },
                borderColor: "divider",
              }}
            >
              <Typography variant="body2" color="text.secondary">
                {card.label}
              </Typography>
              <Typography sx={{ mt: 0.75, fontSize: 28, fontWeight: 700, letterSpacing: "-0.04em" }}>
                {card.value}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                {card.note}
              </Typography>
            </Box>
          ))}
        </Box>
      </Card>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.2fr 0.8fr" }, gap: 2, mb: 2.5 }}>
        <Card>
          <CardContent>
            <Typography sx={{ fontWeight: 600, mb: 0.5 }}>Cleared sales by day</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Schedule 01 documents cleared in {metrics.seriesLabel}.
            </Typography>
            {metrics.daily.every((point) => point.count === 0) ? (
              <Typography color="text.secondary">No cleared sales in this month.</Typography>
            ) : (
              <Box
                role="img"
                aria-label="Daily cleared sales"
                sx={{ display: "flex", alignItems: "flex-end", gap: "3px", height: 112 }}
              >
                {metrics.daily.map((point) => (
                  <Box
                    key={point.label}
                    title={`${point.label}: ${point.count}`}
                    sx={{
                      flex: 1,
                      height: `${Math.max((point.count / peak) * 100, point.count ? 6 : 0)}%`,
                      bgcolor: "primary.main",
                      borderRadius: 0.75,
                    }}
                  />
                ))}
              </Box>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography sx={{ fontWeight: 600 }}>Credit notes to sales</Typography>
            <Typography
              sx={{
                mt: 1,
                fontSize: 28,
                fontWeight: 700,
                letterSpacing: "-0.04em",
                color: metrics.creditNoteElevated ? "warning.main" : "text.primary",
              }}
            >
              {metrics.creditNoteRatio}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, mb: 2 }}>
              {metrics.creditNoteElevated
                ? "Above 5% of cleared Schedule 01 sales."
                : "Cleared credit notes against cleared Schedule 01 sales."}
            </Typography>
            <Stack spacing={1}>
              {metrics.taxMix.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No cleared sales to split by tax class.
                </Typography>
              ) : (
                metrics.taxMix.map((slice) => (
                  <Stack key={slice.label} direction="row" sx={{ justifyContent: "space-between", gap: 2 }}>
                    <Typography variant="body2">{slice.label}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {slice.share} · {slice.amount}
                    </Typography>
                  </Stack>
                ))
              )}
            </Stack>
          </CardContent>
        </Card>
      </Box>
      <Typography sx={{ fontWeight: 600, mb: 1.5 }}>Entity health</Typography>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
          gap: 1.5,
          mb: 3,
        }}
      >
        {health.map((entity) => (
          <Card key={entity.id} sx={{ opacity: entity.selected ? 1 : 0.55 }}>
            <CardContent>
              <Typography sx={{ fontWeight: 600 }}>{entity.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                TIN {entity.tin}
              </Typography>
              <Stack spacing={0.75} sx={{ mt: 1.5 }}>
                <Typography variant="body2">Clearance {entity.clearanceRate}</Typography>
                <Typography variant="body2">{entity.unapprovedInput} unapproved purchases</Typography>
                <Typography variant="body2">{entity.rejected} rejected</Typography>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Box>
      <Typography sx={{ fontWeight: 600, mb: 1.5 }}>Latest documents</Typography>
      <Card>
        {portal.recent.length === 0 ? (
          <Typography color="text.secondary" sx={{ px: 2.5, py: 2 }}>
            No documents in this view.
          </Typography>
        ) : (
          <InvoiceTable rows={portal.recent} />
        )}
      </Card>
    </>
  );
}
