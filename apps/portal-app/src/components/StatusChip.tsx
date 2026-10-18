"use client";

import Chip from "@mui/material/Chip";
import type { InvoiceStatus } from "@/lib/types";

const tone: Record<InvoiceStatus, "success" | "error" | "warning" | "default"> = {
  Cleared: "success",
  Rejected: "error",
  Submitting: "warning",
  Skipped: "default",
};

export default function StatusChip({ status }: { status: InvoiceStatus }) {
  return <Chip label={status} size="small" color={tone[status]} />;
}
