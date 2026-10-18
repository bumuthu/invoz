import ScheduleView from "./ScheduleView";
import { loadPortal } from "@/lib/portal";

export default async function SchedulePage() {
  const portal = await loadPortal();
  return <ScheduleView rows={portal.scheduleRows} />;
}
