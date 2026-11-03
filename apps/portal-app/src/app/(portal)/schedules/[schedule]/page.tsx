"use client";

import { notFound, useParams } from "next/navigation";
import { useCallback } from "react";
import PageData from "@/components/PageData";
import { fetchScheduleDocuments, fetchSchedulePurchases } from "@/lib/portal-client";
import ScheduleView from "../../schedule-02/ScheduleView";
import ScheduleDocuments from "./ScheduleDocuments";

const documents = {
  "01": {
    title: "Schedule 01",
    description: "Output tax, including exempt supplies, for the selected period.",
  },
  "04": {
    title: "Schedule 04",
    description: "Credit notes and debit notes for the selected period.",
  },
  "07": {
    title: "Schedule 07",
    description: "Zero-rated supplies for the selected period.",
  },
} as const;

export default function SchedulePage() {
  const { schedule } = useParams<{ schedule: string }>();
  if (schedule === "02") return <Purchases />;
  if (schedule !== "01" && schedule !== "04" && schedule !== "07") notFound();
  return <Documents schedule={schedule} />;
}

function Purchases() {
  return (
    <PageData load={fetchSchedulePurchases}>
      {(portal) => (
        <ScheduleView
          rows={portal.scheduleRows}
          organizationId={portal.organization.id}
          canApprove={portal.canApprove}
        />
      )}
    </PageData>
  );
}

function Documents({ schedule }: { schedule: "01" | "04" | "07" }) {
  const load = useCallback((search: string) => fetchScheduleDocuments(schedule, search), [schedule]);
  const page = documents[schedule];
  return (
    <PageData load={load}>
      {(portal) => (
        <ScheduleDocuments
          title={page.title}
          description={page.description}
          schedule={schedule}
          invoices={portal.invoices}
        />
      )}
    </PageData>
  );
}
