import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import InvoiceTable from "@/components/InvoiceTable";
import PageHeader from "@/components/PageHeader";
import { loadPortal } from "@/lib/portal";

const count = new Intl.NumberFormat("en-US");

export default async function OverviewPage() {
  const portal = await loadPortal();
  const { invoices, organization, usage } = portal;
  const metrics = [
    { label: "Cleared", value: count.format(invoices.filter((invoice) => invoice.status === "Cleared").length) },
    { label: "Waiting", value: count.format(invoices.filter((invoice) => invoice.status === "Submitting").length) },
    { label: "Rejected", value: count.format(invoices.filter((invoice) => invoice.status === "Rejected").length) },
    { label: "Used", value: count.format(usage.clearedCount) },
  ];
  const allowanceUsed = organization.monthlyAllowance === 0 ? 0 : (usage.clearedCount / organization.monthlyAllowance) * 100;
  return (
    <>
      <PageHeader
        title="Overview"
        description={`${organization.entity} · ${usage.monthLabel}`}
      />
      <Card sx={{ mb: 3 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
          }}
        >
          {metrics.map((metric, index) => (
            <Box
              key={metric.label}
              sx={{
                px: 2.75,
                py: 2.5,
                borderRight: { md: index < metrics.length - 1 ? 1 : 0 },
                borderBottom: { xs: index < 2 ? 1 : 0, md: 0 },
                borderColor: "divider",
              }}
            >
              <Typography variant="body2" color="text.secondary">
                {metric.label}
              </Typography>
              <Typography sx={{ mt: 0.75, fontSize: 28, fontWeight: 700, letterSpacing: "-0.04em" }}>
                {metric.value}
              </Typography>
            </Box>
          ))}
        </Box>
        <Stack spacing={1} sx={{ px: 2.5, py: 2, borderTop: 1, borderColor: "divider" }}>
          <Typography variant="body2" color="text.secondary">
            {count.format(usage.clearedCount)} of {count.format(organization.monthlyAllowance)} invoices this month
          </Typography>
          <LinearProgress
            variant="determinate"
            value={allowanceUsed}
          />
        </Stack>
      </Card>
      <Typography sx={{ fontWeight: 600, mb: 1.5 }}>Latest invoices</Typography>
      <Card>
        <InvoiceTable rows={invoices.slice(0, 4)} />
      </Card>
    </>
  );
}
