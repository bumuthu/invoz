import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import PageHeader from "@/components/PageHeader";
import { loadPortal } from "@/lib/portal";

export default async function BranchesPage() {
  const { branches } = await loadPortal();
  return (
    <>
      <PageHeader
        title="Branches"
        description="Each depot keeps its own monthly serial. The code is the QQQQ segment."
      />
      <Card>
        {branches.map((branch, index) => (
          <Stack
            key={branch.code}
            direction="row"
            sx={{
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: 2,
              px: 2.5,
              py: 2,
              borderTop: index === 0 ? 0 : 1,
              borderColor: "divider",
            }}
          >
            <Box>
              <Typography sx={{ fontWeight: 600 }}>{branch.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                {branch.code}
              </Typography>
            </Box>
            <Typography sx={{ fontWeight: 600, color: "primary.main" }}>{branch.nextSerial}</Typography>
          </Stack>
        ))}
      </Card>
    </>
  );
}
