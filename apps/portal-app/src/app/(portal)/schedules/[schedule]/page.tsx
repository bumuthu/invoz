import { notFound } from "next/navigation";
import ScheduleView from "../../schedule-02/ScheduleView";
import ScheduleDocuments from "./ScheduleDocuments";
import { loadPortal } from "@/lib/portal";
import type { Invoice } from "@/lib/types";

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

export default async function SchedulePage({ params }: { params: Promise<{ schedule: string }> }) {
  const { schedule } = await params;
  const portal = await loadPortal();

  if (schedule === "02") {
    return (
      <ScheduleView
        rows={portal.scheduleRows}
        organizationId={portal.organization.id}
        canApprove={portal.canApprove}
      />
    );
  }

  if (schedule !== "01" && schedule !== "04" && schedule !== "07") notFound();
  const page = documents[schedule];
  const invoices = portal.invoices.filter((invoice: Invoice) => invoice.schedule === schedule);
  return <ScheduleDocuments title={page.title} description={page.description} schedule={schedule} invoices={invoices} />;
}
