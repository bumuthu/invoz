"use client";

import Button from "@mui/material/Button";
import { useSearchParams } from "next/navigation";

export default function ScheduleDownload({ schedule }: { schedule: string }) {
  const search = useSearchParams().toString();
  return (
    <Button component="a" href={`/export/schedules/${schedule}${search ? `?${search}` : ""}`} variant="outlined">
      Download CSV
    </Button>
  );
}
