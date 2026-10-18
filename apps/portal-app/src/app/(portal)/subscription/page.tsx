import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import PageHeader from "@/components/PageHeader";
import { loadPortal } from "@/lib/portal";

const count = new Intl.NumberFormat("en-US");

export default async function SubscriptionPage() {
  const { organization, usage } = await loadPortal();
  const lines = [
    ["Plan", "Professional"],
    ["Allowance", `${count.format(organization.monthlyAllowance)} invoices / month`],
    [`Used in ${usage.monthLabel}`, count.format(usage.clearedCount)],
    ["Overage rate", "LKR 8.00"],
    ["Billed to", organization.name],
  ];
  const allowanceUsed = organization.monthlyAllowance === 0 ? 0 : (usage.clearedCount / organization.monthlyAllowance) * 100;
  return (
    <>
      <PageHeader
        title="Subscription"
        description="One plan covers every legal entity in this organization. Usage is counted on cleared invoices."
      />
      <Card sx={{ maxWidth: 640 }}>
        <CardContent>
          <Stack spacing={2}>
            {lines.map(([label, value]) => (
              <Stack key={label} direction="row" sx={{ justifyContent: "space-between", gap: 2 }}>
                <Typography color="text.secondary">{label}</Typography>
                <Typography sx={{ fontWeight: 700 }}>{value}</Typography>
              </Stack>
            ))}
            <LinearProgress
              variant="determinate"
              value={allowanceUsed}
            />
          </Stack>
        </CardContent>
      </Card>
    </>
  );
}
