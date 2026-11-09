"use client";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import type { ReactNode } from "react";
import { usePortalPath } from "@/lib/portal-nav";

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

function PageIntro({
  title,
  width,
  lines = 1,
  action,
}: {
  title: number;
  width: number;
  lines?: 1 | 2;
  action?: number;
}) {
  const text = (
    <Box sx={{ minWidth: 0, flex: 1 }}>
      <Bone width={title} height={32} />
      <Stack spacing={0.75} sx={{ mt: 1.25, maxWidth: width }}>
        <Bone width="100%" height={16} />
        {lines === 2 ? <Bone width="72%" height={16} /> : null}
      </Stack>
    </Box>
  );
  if (!action) return <Box sx={{ mb: 2.5 }}>{text}</Box>;
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={2}
      sx={{ justifyContent: "space-between", alignItems: { sm: "flex-end" }, mb: 2.5 }}
    >
      {text}
      <Bone width={action} height={36} />
    </Stack>
  );
}

function SectionLabel({ width, action }: { width: number; action?: number }) {
  return (
    <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", gap: 2, mb: 1.5 }}>
      <Bone width={width} height={18} />
      {action ? <Bone width={action} height={36} /> : null}
    </Stack>
  );
}

function LinedTable({
  columns,
  headers,
  minWidth,
  rows,
  renderRow,
}: {
  columns: string;
  headers: number[];
  minWidth: number;
  rows: number;
  renderRow: (row: number) => ReactNode;
}) {
  return (
    <Card sx={{ overflow: "hidden" }}>
      <Box sx={{ overflowX: "auto" }}>
        <Box sx={{ minWidth }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: columns,
              columnGap: 2,
              alignItems: "center",
              px: 2,
              py: 1.5,
              borderBottom: 1,
              borderColor: "divider",
            }}
          >
            {headers.map((width, index) => (
              <Bone key={index} width={width} height={12} />
            ))}
          </Box>
          {Array.from({ length: rows }, (_, row) => (
            <Box
              key={row}
              sx={{
                display: "grid",
                gridTemplateColumns: columns,
                columnGap: 2,
                alignItems: "center",
                px: 2,
                py: 1.5,
                borderBottom: 1,
                borderColor: "divider",
                "&:last-of-type": { borderBottom: 0 },
              }}
            >
              {renderRow(row)}
            </Box>
          ))}
        </Box>
      </Box>
    </Card>
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
  const labels = [132, 118, 148, 136];
  const values = [168, 96, 152, 48];
  const documents = "minmax(128px, 1.2fr) minmax(180px, 1.7fr) minmax(96px, 0.9fr) minmax(80px, 0.7fr) 88px";

  return (
    <>
      <PageIntro title={148} width={520} lines={2} action={196} />
      <Card sx={{ mb: 2.5 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
          {labels.map((label, index) => (
            <Box
              key={label}
              sx={{
                px: 2.75,
                py: 2.5,
                borderRight: { md: index % 2 === 0 ? 1 : 0 },
                borderBottom: { xs: index < labels.length - 1 ? 1 : 0, md: index < 2 ? 1 : 0 },
                borderColor: "divider",
              }}
            >
              <Bone width={label} height={14} />
              <Box sx={{ mt: 1 }}>
                <Bone width={values[index]} height={28} />
              </Box>
              <Stack spacing={0.75} sx={{ mt: 1.25, maxWidth: 360 }}>
                <Bone width="100%" height={14} />
                {index === 0 ? <Bone width="64%" height={14} /> : null}
              </Stack>
            </Box>
          ))}
        </Box>
      </Card>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.2fr 0.8fr" }, gap: 2, mb: 2.5 }}>
        <Card>
          <Stack spacing={1} sx={{ p: 2 }}>
            <Bone width={168} height={16} />
            <Bone width="72%" height={14} />
            <Box sx={{ display: "flex", alignItems: "flex-end", gap: "3px", height: 112, pt: 1 }}>
              {Array.from({ length: 28 }, (_, index) => (
                <Skeleton
                  key={index}
                  variant="rounded"
                  animation="wave"
                  sx={{ flex: 1, height: `${18 + ((index * 23) % 78)}%`, borderRadius: 0.75 }}
                />
              ))}
            </Box>
          </Stack>
        </Card>
        <Card>
          <Stack spacing={1.25} sx={{ p: 2 }}>
            <Bone width={168} height={16} />
            <Bone width={88} height={28} />
            <Bone width="90%" height={14} />
            <Stack spacing={1} sx={{ pt: 0.5 }}>
              {Array.from({ length: 3 }, (_, index) => (
                <Stack key={index} direction="row" sx={{ justifyContent: "space-between", gap: 2 }}>
                  <Bone width={index === 1 ? 96 : 72} height={14} />
                  <Bone width={108} height={14} />
                </Stack>
              ))}
            </Stack>
          </Stack>
        </Card>
      </Box>
      <SectionLabel width={112} />
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
          gap: 1.5,
          mb: 3,
        }}
      >
        {Array.from({ length: 3 }, (_, index) => (
          <Card key={index}>
            <Stack spacing={0.75} sx={{ p: 2 }}>
              <Bone width={index === 1 ? "62%" : "78%"} height={16} />
              <Bone width={108} height={12} />
              <Stack spacing={0.75} sx={{ pt: 0.75 }}>
                <Bone width="70%" height={14} />
                <Bone width="84%" height={14} />
                <Bone width="48%" height={14} />
              </Stack>
            </Stack>
          </Card>
        ))}
      </Box>
      <SectionLabel width={148} />
      <LinedTable
        columns={documents}
        headers={[56, 52, 58, 64, 52]}
        minWidth={680}
        rows={4}
        renderRow={(row) => (
          <>
            <Stack spacing={0.75}>
              <Bone width={row % 2 === 0 ? "76%" : "58%"} height={14} />
              <Bone width="42%" height={10} />
            </Stack>
            <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", minWidth: 0 }}>
              <Skeleton variant="circular" animation="wave" width={32} height={32} />
              <Stack spacing={0.6} sx={{ flex: 1, minWidth: 0 }}>
                <Bone width={row % 2 === 0 ? "72%" : "56%"} height={14} />
                <Bone width="46%" height={10} />
              </Stack>
            </Stack>
            <Bone width={row % 2 === 0 ? "64%" : "48%"} height={14} />
            <Bone width="70%" height={14} />
            <Skeleton variant="rounded" animation="wave" width={72} height={24} sx={{ borderRadius: 4 }} />
          </>
        )}
      />
    </>
  );
}

function AuditSkeleton() {
  const gaps = "minmax(88px, 0.7fr) minmax(120px, 1.1fr) 72px minmax(140px, 1.2fr) minmax(140px, 1.4fr)";
  const events = "minmax(150px, 0.9fr) minmax(140px, 1fr) minmax(180px, 1.5fr)";

  return (
    <>
      <PageIntro title={88} width={420} action={188} />
      <SectionLabel width={132} />
      <Box sx={{ mb: 3 }}>
        <LinedTable
          columns={gaps}
          headers={[56, 60, 48, 52, 68]}
          minWidth={680}
          rows={4}
          renderRow={(row) => (
            <>
              <Bone width="78%" height={14} />
              <Bone width={row % 2 === 0 ? "70%" : "52%"} height={14} />
              <Bone width={28} height={14} />
              <Bone width="80%" height={14} />
              <Bone width={row % 2 === 0 ? "64%" : "46%"} height={14} />
            </>
          )}
        />
      </Box>
      <SectionLabel width={96} />
      <LinedTable
        columns={events}
        headers={[48, 52, 80]}
        minWidth={560}
        rows={6}
        renderRow={(row) => (
          <>
            <Bone width="82%" height={14} />
            <Bone width={row % 2 === 0 ? "74%" : "58%"} height={14} />
            <Bone width={row % 3 === 0 ? "70%" : "86%"} height={14} />
          </>
        )}
      />
    </>
  );
}

function IngestionSkeleton() {
  return (
    <>
      <PageIntro title={148} width={520} lines={2} />
      <Box sx={{ mb: 3 }}>
        <LinedTable
          columns="minmax(140px, 1fr) 120px"
          headers={[56, 92]}
          minWidth={320}
          rows={4}
          renderRow={(row) => (
            <>
              <Bone width={[72, 68, 80, 70][row]} height={14} />
              <Bone width={36} height={14} />
            </>
          )}
        />
      </Box>
      <SectionLabel width={128} />
      <LinedTable
        columns="minmax(150px, 0.9fr) minmax(140px, 1fr) minmax(180px, 1.5fr)"
        headers={[48, 52, 80]}
        minWidth={560}
        rows={6}
        renderRow={(row) => (
          <>
            <Bone width="82%" height={14} />
            <Bone width={row % 2 === 0 ? "74%" : "56%"} height={14} />
            <Bone width={row % 3 === 0 ? "68%" : "84%"} height={14} />
          </>
        )}
      />
    </>
  );
}

function SetupTabs({ active }: { active: 0 | 1 | 2 }) {
  const widths = [36, 156, 176];
  return (
    <Stack direction="row" spacing={3} sx={{ mb: 3, pb: 1.25, borderBottom: 1, borderColor: "divider" }}>
      {widths.map((width, index) => (
        <Box key={width} sx={{ position: "relative" }}>
          <Bone width={width} height={14} />
          {index === active ? (
            <Box
              sx={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: -11,
                height: 2,
                bgcolor: "primary.main",
                borderRadius: 1,
              }}
            />
          ) : null}
        </Box>
      ))}
    </Stack>
  );
}

function ErpConnectionBone() {
  return (
    <Card sx={{ mb: 2 }}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", gap: 2, px: 3, py: 3 }}>
        <Stack spacing={1.25} sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
            <Skeleton variant="rounded" animation="wave" width={36} height={28} sx={{ borderRadius: 1 }} />
            <Bone width={132} height={22} />
          </Stack>
          <Bone width="42%" height={14} />
          <Bone width={128} height={32} />
        </Stack>
        <Skeleton variant="rounded" animation="wave" width={64} height={24} sx={{ borderRadius: 4 }} />
      </Stack>
    </Card>
  );
}

function ConfigureBone() {
  return (
    <Card>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, px: 3, py: 2.5 }}
      >
        <Stack spacing={1.25} sx={{ flex: 1, minWidth: 0 }}>
          <Bone width="86%" height={14} />
          <Stack direction="row" spacing={0.75}>
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} variant="rounded" animation="wave" width={32} height={28} sx={{ borderRadius: 1 }} />
            ))}
          </Stack>
        </Stack>
        <Bone width={112} height={36} />
      </Stack>
    </Card>
  );
}

function SetupErpSkeleton() {
  return (
    <>
      <SetupTabs active={0} />
      <PageIntro title={64} width={520} lines={2} />
      <SectionLabel width={52} />
      <ErpConnectionBone />
      <Box sx={{ mb: 4 }}>
        <ConfigureBone />
      </Box>
      <SectionLabel width={84} />
      <Skeleton variant="rounded" animation="wave" height={48} sx={{ mb: 2, borderRadius: 1 }} />
      <ErpConnectionBone />
      <ConfigureBone />
    </>
  );
}

function SetupRamisSkeleton() {
  return (
    <>
      <SetupTabs active={1} />
      <PageIntro title={220} width={540} lines={2} />
      <Card>
        {Array.from({ length: 3 }, (_, index) => (
          <Stack
            key={index}
            direction="row"
            sx={{
              justifyContent: "space-between",
              alignItems: "center",
              gap: 2,
              px: 2.5,
              py: 2,
              borderTop: index === 0 ? 0 : 1,
              borderColor: "divider",
            }}
          >
            <Stack spacing={0.6}>
              <Bone width={index % 2 === 0 ? 180 : 140} height={16} />
              <Bone width={128} height={12} />
            </Stack>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexShrink: 0 }}>
              <Bone width={64} height={14} />
              <Skeleton variant="rounded" animation="wave" width={42} height={24} sx={{ borderRadius: 6 }} />
            </Stack>
          </Stack>
        ))}
      </Card>
    </>
  );
}

function RecordList({ rows, trailing }: { rows: number; trailing: "text" | "serial" }) {
  return (
    <Card>
      {Array.from({ length: rows }, (_, index) => (
        <Stack
          key={index}
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
          <Stack spacing={0.6} sx={{ minWidth: 0, flex: 1 }}>
            <Bone width={index % 2 === 0 ? 168 : 124} height={16} />
            <Bone width={trailing === "serial" ? 148 : 132} height={12} />
          </Stack>
          <Bone width={trailing === "serial" ? 132 : 108} height={14} />
        </Stack>
      ))}
    </Card>
  );
}

function SetupOrganizationSkeleton() {
  return (
    <>
      <SetupTabs active={2} />
      <PageIntro title={248} width={540} lines={2} />
      <SectionLabel width={124} action={148} />
      <Box sx={{ mb: 4 }}>
        <RecordList rows={3} trailing="text" />
      </Box>
      <SectionLabel width={88} action={112} />
      <RecordList rows={4} trailing="serial" />
    </>
  );
}

function UsersSkeleton() {
  return (
    <>
      <PageIntro title={92} width={560} lines={2} />
      <Card sx={{ mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ p: 2, alignItems: { md: "center" } }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Bone width="100%" height={40} />
          </Box>
          <Bone width={160} height={40} />
          <Bone width={88} height={36} />
        </Stack>
      </Card>
      <LinedTable
        columns="minmax(180px, 1.15fr) minmax(200px, 1.6fr) minmax(96px, 0.6fr)"
        headers={[52, 52, 40]}
        minWidth={560}
        rows={6}
        renderRow={(row) => (
          <>
            <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", minWidth: 0 }}>
              <Skeleton variant="circular" animation="wave" width={32} height={32} />
              <Bone width={row % 2 === 0 ? "68%" : "50%"} height={14} />
            </Stack>
            <Bone width={row % 2 === 0 ? "76%" : "62%"} height={14} />
            <Bone width={72} height={14} />
          </>
        )}
      />
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

function ExceptionsSkeleton() {
  const columns = "minmax(128px, 1.05fr) minmax(104px, 0.7fr) minmax(160px, 1.15fr) minmax(220px, 2fr)";
  const failureWidth = ["92%", "74%", "84%", "66%"];

  return (
    <>
      <Box sx={{ mb: 2.5 }}>
        <Bone width={164} height={32} />
        <Stack spacing={0.75} sx={{ mt: 1.25, maxWidth: 560 }}>
          <Bone width="100%" height={16} />
          <Bone width="68%" height={16} />
        </Stack>
      </Box>
      <Card sx={{ overflow: "hidden" }}>
        <Box sx={{ overflowX: "auto" }}>
          <Box sx={{ minWidth: 680 }}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: columns,
                columnGap: 2,
                alignItems: "center",
                px: 2,
                py: 1.5,
                borderBottom: 1,
                borderColor: "divider",
              }}
            >
              {[56, 44, 52, 64].map((width, index) => (
                <Bone key={index} width={width} height={12} />
              ))}
            </Box>
            {Array.from({ length: 8 }, (_, row) => (
              <Box
                key={row}
                sx={{
                  display: "grid",
                  gridTemplateColumns: columns,
                  columnGap: 2,
                  alignItems: "center",
                  px: 2,
                  py: 1.5,
                  borderBottom: 1,
                  borderColor: "divider",
                  "&:last-of-type": { borderBottom: 0 },
                }}
              >
                <Stack spacing={0.75}>
                  <Bone width={row % 2 === 0 ? "76%" : "58%"} height={14} />
                  <Bone width="46%" height={10} />
                </Stack>
                <Bone width="84%" height={14} />
                <Stack spacing={0.6}>
                  <Bone width={row % 2 === 0 ? "72%" : "56%"} height={14} />
                  <Bone width="48%" height={10} />
                </Stack>
                <Stack spacing={0.75} sx={{ minWidth: 0 }}>
                  <Bone width={failureWidth[row % failureWidth.length]} height={14} />
                  {row % 2 === 0 ? (
                    <Skeleton variant="rounded" animation="wave" width={108} height={24} sx={{ borderRadius: 4 }} />
                  ) : null}
                </Stack>
              </Box>
            ))}
          </Box>
        </Box>
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

function ScheduleHeading({
  title,
  description,
  actions,
}: {
  title: number;
  description: number;
  actions: number;
}) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={2}
      sx={{ justifyContent: "space-between", alignItems: { sm: "flex-end" }, mb: 2.5 }}
    >
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Bone width={title} height={32} />
        <Box sx={{ mt: 1.25, maxWidth: description }}>
          <Bone width="100%" height={16} />
        </Box>
      </Box>
      <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
        {Array.from({ length: actions }, (_, index) => (
          <Bone key={index} width={index === 0 ? 132 : 176} height={36} />
        ))}
      </Stack>
    </Stack>
  );
}

function ScheduleDocumentsSkeleton() {
  const columns = "minmax(128px, 1.25fr) minmax(104px, 0.8fr) minmax(180px, 1.7fr) minmax(96px, 0.9fr) minmax(80px, 0.7fr) 88px";
  const nameWidth = ["76%", "62%", "84%", "68%"];

  return (
    <>
      <ScheduleHeading title={156} description={440} actions={1} />
      <Card sx={{ overflow: "hidden" }}>
        <Box sx={{ overflowX: "auto" }}>
          <Box sx={{ minWidth: 760 }}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: columns,
                columnGap: 2,
                alignItems: "center",
                px: 2,
                py: 1.5,
                borderBottom: 1,
                borderColor: "divider",
              }}
            >
              {[64, 44, 52, 58, 64, 52].map((width, index) => (
                <Bone key={index} width={width} height={12} />
              ))}
            </Box>
            {Array.from({ length: 8 }, (_, row) => (
              <Box
                key={row}
                sx={{
                  display: "grid",
                  gridTemplateColumns: columns,
                  columnGap: 2,
                  alignItems: "center",
                  px: 2,
                  py: 1.5,
                  borderBottom: 1,
                  borderColor: "divider",
                  "&:last-of-type": { borderBottom: 0 },
                }}
              >
                <Stack spacing={0.75}>
                  <Bone width={row % 2 === 0 ? "78%" : "62%"} height={14} />
                  <Bone width="42%" height={10} />
                </Stack>
                <Bone width="86%" height={14} />
                <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", minWidth: 0 }}>
                  <Skeleton variant="circular" animation="wave" width={32} height={32} />
                  <Stack spacing={0.6} sx={{ flex: 1, minWidth: 0 }}>
                    <Bone width={nameWidth[row % nameWidth.length]} height={14} />
                    <Bone width="46%" height={10} />
                  </Stack>
                </Stack>
                <Bone width={row % 3 === 0 ? "70%" : "54%"} height={14} />
                <Bone width="72%" height={14} />
                <Skeleton variant="rounded" animation="wave" width={72} height={24} sx={{ borderRadius: 4 }} />
              </Box>
            ))}
          </Box>
        </Box>
      </Card>
    </>
  );
}

function SchedulePurchasesSkeleton() {
  const purchases = "36px minmax(150px, 1.6fr) minmax(96px, 1fr) minmax(104px, 0.9fr) minmax(72px, 0.7fr)";
  const vouchers = "minmax(140px, 1fr) 108px";

  return (
    <>
      <ScheduleHeading title={168} description={420} actions={2} />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.15fr 0.85fr" }, gap: 2 }}>
        <Card sx={{ overflow: "hidden" }}>
          <Box sx={{ overflowX: "auto" }}>
            <Box sx={{ minWidth: 560 }}>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: purchases,
                  columnGap: 2,
                  alignItems: "center",
                  px: 2,
                  py: 1.5,
                  borderBottom: 1,
                  borderColor: "divider",
                }}
              >
                <Box />
                {[72, 52, 44, 36].map((width, index) => (
                  <Bone key={index} width={width} height={12} />
                ))}
              </Box>
              {Array.from({ length: 7 }, (_, row) => (
                <Box
                  key={row}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: purchases,
                    columnGap: 2,
                    alignItems: "center",
                    px: 2,
                    py: 1.5,
                    borderBottom: 1,
                    borderColor: "divider",
                    "&:last-of-type": { borderBottom: 0 },
                  }}
                >
                  <Skeleton variant="rounded" animation="wave" width={18} height={18} sx={{ borderRadius: 0.5 }} />
                  <Stack spacing={0.6}>
                    <Bone width={row % 2 === 0 ? "74%" : "58%"} height={14} />
                    <Bone width="48%" height={10} />
                  </Stack>
                  <Bone width="80%" height={14} />
                  <Bone width="86%" height={14} />
                  <Bone width="64%" height={14} />
                </Box>
              ))}
            </Box>
          </Box>
        </Card>
        <Card sx={{ overflow: "hidden" }}>
          <Box sx={{ overflowX: "auto" }}>
            <Box sx={{ minWidth: 280 }}>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: vouchers,
                  columnGap: 2,
                  alignItems: "center",
                  px: 2,
                  py: 1.5,
                  borderBottom: 1,
                  borderColor: "divider",
                }}
              >
                <Bone width={96} height={12} />
                <Bone width={48} height={12} />
              </Box>
              {Array.from({ length: 7 }, (_, row) => (
                <Box
                  key={row}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: vouchers,
                    columnGap: 2,
                    alignItems: "center",
                    px: 2,
                    py: 1.5,
                    borderBottom: 1,
                    borderColor: "divider",
                    "&:last-of-type": { borderBottom: 0 },
                  }}
                >
                  <Bone width={row % 2 === 0 ? "70%" : "52%"} height={14} />
                  <Skeleton variant="rounded" animation="wave" width={84} height={24} sx={{ borderRadius: 4 }} />
                </Box>
              ))}
            </Box>
          </Box>
        </Card>
      </Box>
    </>
  );
}

export function skeletonKind(pathname: string) {
  if (pathname.startsWith("/invoices/")) return "detail";
  if (pathname.startsWith("/audit/statement")) return "statement";
  if (pathname.startsWith("/audit")) return "audit";
  if (pathname.startsWith("/ingestion")) return "ingestion";
  if (pathname.startsWith("/setup/ramis")) return "setup-ramis";
  if (pathname.startsWith("/setup/organization")) return "setup-organization";
  if (pathname.startsWith("/setup")) return "setup-erp";
  if (pathname.startsWith("/subscription")) return "subscription";
  if (pathname === "/schedule-02" || pathname.startsWith("/schedules/02")) return "schedule-purchases";
  if (pathname.startsWith("/schedules")) return "schedule-documents";
  if (pathname.startsWith("/exceptions")) return "exceptions";
  if (pathname.startsWith("/users")) return "users";
  if (pathname.startsWith("/invoices")) return "table";
  return "overview";
}

export default function PageSkeleton({ route }: { route?: string }) {
  const { pathname } = usePortalPath();
  const kind = skeletonKind(route ?? pathname);

  return (
    <Box aria-busy="true" aria-label="Loading page">
      {kind === "detail" ? <DetailSkeleton /> : null}
      {kind === "statement" ? <StatementSkeleton /> : null}
      {kind === "audit" ? <AuditSkeleton /> : null}
      {kind === "ingestion" ? <IngestionSkeleton /> : null}
      {kind === "setup-erp" ? <SetupErpSkeleton /> : null}
      {kind === "setup-ramis" ? <SetupRamisSkeleton /> : null}
      {kind === "setup-organization" ? <SetupOrganizationSkeleton /> : null}
      {kind === "subscription" ? <SubscriptionSkeleton /> : null}
      {kind === "users" ? <UsersSkeleton /> : null}
      {kind === "table" ? <TableSkeleton /> : null}
      {kind === "exceptions" ? <ExceptionsSkeleton /> : null}
      {kind === "schedule-documents" ? <ScheduleDocumentsSkeleton /> : null}
      {kind === "schedule-purchases" ? <SchedulePurchasesSkeleton /> : null}
      {kind === "overview" ? <OverviewSkeleton /> : null}
    </Box>
  );
}
