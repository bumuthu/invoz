import { Suspense } from "react";
import AppShell from "@/components/AppShell";
import { loadPortal } from "@/lib/portal";

export const dynamic = "force-dynamic";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const portal = await loadPortal();

  return (
    <Suspense>
      <AppShell
        organization={portal.organization}
        organizations={portal.organizations}
        hostPinned={portal.hostPinned}
        currentUser={portal.currentUser}
        canAudit={portal.canAudit}
        filters={portal.filters}
        entities={portal.entities}
        branches={portal.branches}
        periods={portal.periods}
      >
        {children}
      </AppShell>
    </Suspense>
  );
}
