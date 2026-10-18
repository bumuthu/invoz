import MappingView from "./MappingView";
import { loadPortal } from "@/lib/portal";

export default async function MappingPage() {
  const portal = await loadPortal();
  return (
    <MappingView fieldMappings={portal.fieldMappings} targetFields={portal.targetFields} />
  );
}
