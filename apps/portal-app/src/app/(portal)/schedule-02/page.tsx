import ScheduleView from "./ScheduleView";
import { loadPortal } from "@/lib/portal";

export default async function SchedulePage() {
  const portal = await loadPortal();
  return (
    <ScheduleView
      rows={portal.scheduleRows}
      organizationId={portal.organization.id}
      canApprove={portal.canApprove}
      hiddenBySchedule={portal.filters.schedule === "01" || portal.filters.schedule === "04"}
    />
  );
}
