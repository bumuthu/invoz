"use client";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import { usePathname } from "next/navigation";

function Bone({
  width,
  height = 14,
}: {
  width: number | string;
  height?: number;
}) {
  return <Skeleton variant="rounded" animation="wave" width={width} height={height} sx={{ borderRadius: 1.5 }} />;
}

function Header({ title, description }: { title: number; description: number }) {
  return (
    <Box sx={{ mb: 2.5 }}>
      <Bone width={title} height={32} />
      <Box sx={{ mt: 1.25 }}>
        <Bone width={description} height={16} />
      </Box>
    </Box>
  );
}

function TableBlock({ rows, columns = 5 }: { rows: number; columns?: number }) {
  return (
    <Card>
      <Stack spacing={1.75} sx={{ p: 2.5 }}>
        <Stack direction="row" spacing={2}>
          {Array.from({ length: columns }, (_, index) => (
            <Bone key={index} width={`${Math.floor(100 / columns)}%`} height={12} />
          ))}
        </Stack>
        {Array.from({ length: rows }, (_, index) => (
          <Bone key={index} width={index % 3 === 1 ? "86%" : "100%"} height={18} />
        ))}
      </Stack>
    </Card>
  );
}

function OverviewSkeleton() {
  return (
    <>
      <Header title={160} description={420} />
      <Card sx={{ mb: 2.5 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
          {Array.from({ length: 4 }, (_, index) => (
            <Box
              key={index}
              sx={{
                px: 2.75,
                py: 2.5,
                borderRight: { md: index % 2 === 0 ? 1 : 0 },
                borderBottom: { xs: index < 3 ? 1 : 0, md: index < 2 ? 1 : 0 },
                borderColor: "divider",
              }}
            >
              <Bone width={120} height={14} />
              <Box sx={{ mt: 1.25 }}>
                <Bone width={180} height={28} />
              </Box>
              <Box sx={{ mt: 1.25 }}>
                <Bone width="80%" height={14} />
              </Box>
            </Box>
          ))}
        </Box>
      </Card>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.2fr 0.8fr" }, gap: 2, mb: 2.5 }}>
        <Card>
          <Box sx={{ p: 2.5 }}>
            <Bone width={160} height={16} />
            <Box sx={{ mt: 2, display: "flex", alignItems: "flex-end", gap: "6px", height: 112 }}>
              {Array.from({ length: 16 }, (_, index) => (
                <Skeleton
                  key={index}
                  variant="rounded"
                  animation="wave"
                  sx={{ flex: 1, height: `${30 + ((index * 17) % 70)}%`, borderRadius: 0.75 }}
                />
              ))}
            </Box>
          </Box>
        </Card>
        <Card>
          <Stack spacing={1.5} sx={{ p: 2.5 }}>
            <Bone width={140} height={16} />
            <Bone width={100} height={28} />
            <Bone width="90%" height={14} />
          </Stack>
        </Card>
      </Box>
      <TableBlock rows={4} />
    </>
  );
}

function AuditSkeleton() {
  return (
    <>
      <Header title={120} description={360} />
      <Box sx={{ mb: 1.5 }}>
        <Bone width={140} height={16} />
      </Box>
      <Box sx={{ mb: 3 }}>
        <TableBlock rows={3} columns={4} />
      </Box>
      <Box sx={{ mb: 1.5 }}>
        <Bone width={120} height={16} />
      </Box>
      <TableBlock rows={5} columns={3} />
    </>
  );
}

function IngestionSkeleton() {
  return (
    <>
      <Header title={150} description={400} />
      <Box sx={{ mb: 3 }}>
        <TableBlock rows={4} columns={2} />
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
        <Card>
          <Stack spacing={1.5} sx={{ p: 2.5 }}>
            <Bone width={140} height={16} />
            <Bone width="100%" height={14} />
            <Bone width="70%" height={14} />
          </Stack>
        </Card>
        <Card>
          <Stack spacing={1.5} sx={{ p: 2.5 }}>
            <Bone width={120} height={16} />
            <Bone width="100%" height={14} />
            <Bone width="60%" height={14} />
          </Stack>
        </Card>
      </Box>
    </>
  );
}

function FormSkeleton() {
  return (
    <>
      <Header title={180} description={380} />
      <Card>
        <Stack spacing={2} sx={{ p: 2.5 }}>
          {Array.from({ length: 6 }, (_, index) => (
            <Stack key={index} direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <Bone width="40%" height={40} />
              <Bone width="40%" height={40} />
            </Stack>
          ))}
        </Stack>
      </Card>
    </>
  );
}

function ListSkeleton() {
  return (
    <>
      <Header title={140} description={340} />
      <Card>
        <Stack spacing={0} sx={{ py: 1 }}>
          {Array.from({ length: 4 }, (_, index) => (
            <Stack key={index} direction="row" spacing={2} sx={{ px: 2.5, py: 2, alignItems: "center" }}>
              <Bone width={48} height={48} />
              <Box sx={{ flex: 1 }}>
                <Bone width={160} height={16} />
                <Box sx={{ mt: 0.75 }}>
                  <Bone width={100} height={12} />
                </Box>
              </Box>
              <Bone width={140} height={16} />
            </Stack>
          ))}
        </Stack>
      </Card>
    </>
  );
}

function SubscriptionSkeleton() {
  return (
    <>
      <Header title={180} description={420} />
      <Card sx={{ maxWidth: 640 }}>
        <Stack spacing={2} sx={{ p: 2.5 }}>
          {Array.from({ length: 5 }, (_, index) => (
            <Stack key={index} direction="row" sx={{ justifyContent: "space-between" }}>
              <Bone width={120} height={16} />
              <Bone width={160} height={16} />
            </Stack>
          ))}
          <Bone width="100%" height={8} />
        </Stack>
      </Card>
    </>
  );
}

function DetailSkeleton() {
  return (
    <>
      <Header title={240} description={280} />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.4fr 0.8fr" }, gap: 2 }}>
        <Card>
          <Stack spacing={1.75} sx={{ p: 2.5 }}>
            {Array.from({ length: 7 }, (_, index) => (
              <Stack key={index} direction="row" sx={{ justifyContent: "space-between" }}>
                <Bone width={120} height={14} />
                <Bone width={160} height={14} />
              </Stack>
            ))}
          </Stack>
        </Card>
        <Card>
          <Stack spacing={1.5} sx={{ p: 2.5, alignItems: "center" }}>
            <Skeleton variant="rounded" animation="wave" width={148} height={148} />
            <Bone width={120} height={14} />
          </Stack>
        </Card>
      </Box>
    </>
  );
}

function StatementSkeleton() {
  return (
    <>
      <Header title={240} description={360} />
      <Card sx={{ maxWidth: 720 }}>
        <Stack spacing={1.5} sx={{ p: 3 }}>
          <Bone width={200} height={18} />
          <Bone width="100%" height={14} />
          <Bone width="94%" height={14} />
          <Bone width="88%" height={14} />
          <Box sx={{ pt: 1 }}>
            <Bone width={160} height={14} />
          </Box>
        </Stack>
      </Card>
    </>
  );
}

function TableSkeleton() {
  return (
    <>
      <Header title={170} description={380} />
      <TableBlock rows={8} />
    </>
  );
}

export function skeletonKind(pathname: string) {
  if (pathname.startsWith("/invoices/")) return "detail";
  if (pathname.startsWith("/audit/statement")) return "statement";
  if (pathname.startsWith("/audit")) return "audit";
  if (pathname.startsWith("/ingestion")) return "ingestion";
  if (pathname.startsWith("/setup/mapping")) return "form";
  if (pathname.startsWith("/setup/branches")) return "list";
  if (pathname.startsWith("/subscription")) return "subscription";
  if (
    pathname.startsWith("/invoices") ||
    pathname.startsWith("/exceptions") ||
    pathname.startsWith("/schedule-02") ||
    pathname.startsWith("/users")
  ) {
    return "table";
  }
  return "overview";
}

export default function PageSkeleton({ route }: { route?: string }) {
  const pathname = usePathname();
  const kind = skeletonKind(route ?? pathname);

  return (
    <Box aria-busy="true" aria-label="Loading page">
      {kind === "detail" ? <DetailSkeleton /> : null}
      {kind === "statement" ? <StatementSkeleton /> : null}
      {kind === "audit" ? <AuditSkeleton /> : null}
      {kind === "ingestion" ? <IngestionSkeleton /> : null}
      {kind === "form" ? <FormSkeleton /> : null}
      {kind === "list" ? <ListSkeleton /> : null}
      {kind === "subscription" ? <SubscriptionSkeleton /> : null}
      {kind === "table" ? <TableSkeleton /> : null}
      {kind === "overview" ? <OverviewSkeleton /> : null}
    </Box>
  );
}
