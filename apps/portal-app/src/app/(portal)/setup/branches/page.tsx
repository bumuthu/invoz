import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import PageHeader from "@/components/PageHeader";
import { loadPortal } from "@/lib/portal";

export default async function BranchesPage() {
  const portal = await loadPortal();
  const branches =
    portal.filters.branch === "all"
      ? portal.branches
      : portal.branches.filter((branch) => branch.id === portal.filters.branch);

  return (
    <>
      <PageHeader
        title="Branches"
        description="Each depot keeps its own monthly serial. The code is the QQQQ segment."
      />
      <Card>
        {branches.length === 0 ? (
          <Typography color="text.secondary" sx={{ px: 2.5, py: 2 }}>
            No branches in this view.
          </Typography>
        ) : (
          branches.map((branch, index) => (
            <Stack
              key={branch.id}
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
                  {branch.entity} · {branch.code}
                </Typography>
              </Box>
              <Typography sx={{ fontWeight: 600, color: "primary.main" }}>{branch.nextSerial}</Typography>
            </Stack>
          ))
        )}
      </Card>
    </>
  );
}
