"use client";

import Button from "@mui/material/Button";
import { usePortalPath } from "@/lib/portal-nav";

export default function ScheduleDownload({ schedule }: { schedule: string }) {
  const { search } = usePortalPath();
  return (
    <Button component="a" href={`/export/schedules/${schedule}${search ? `?${search}` : ""}`} variant="outlined">
      Download CSV
    </Button>
  );
}
