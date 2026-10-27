import { Suspense } from "react";
import AppLoading from "@/components/AppLoading";
import AppShell from "@/components/AppShell";
import { loadShell } from "@/lib/portal";

export const dynamic = "force-dynamic";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<AppLoading />}>
      <PortalFrame>{children}</PortalFrame>
    </Suspense>
  );
}

async function PortalFrame({ children }: { children: React.ReactNode }) {
  const shell = await loadShell();

  return (
    <AppShell
      organization={shell.organization}
      organizations={shell.organizations}
      hostPinned={shell.hostPinned}
      currentUser={shell.currentUser}
      canAudit={shell.canAudit}
      filters={shell.filters}
      entities={shell.entities}
      branches={shell.branches}
      periods={shell.periods}
    >
      {children}
    </AppShell>
  );
}
