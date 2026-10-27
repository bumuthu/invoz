import MappingView from "./MappingView";
import { loadPortal } from "@/lib/portal";

export default async function MappingPage() {
  const portal = await loadPortal();
  const entityId =
    portal.filters.entityId !== "all"
      ? portal.filters.entityId
      : portal.entities.length === 1
        ? portal.entities[0].id
        : null;
  const rows = entityId
    ? portal.fieldMappings.filter((row) => row.entityId === entityId)
    : portal.fieldMappings;

  return (
    <MappingView
      fieldMappings={rows}
      targetFields={portal.targetFields}
      organizationId={portal.organization.id}
      entityId={entityId}
      canMap={portal.canMap}
    />
  );
}
