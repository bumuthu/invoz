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
    <AppShell organization={portal.organization} currentUser={portal.currentUser}>
      {children}
    </AppShell>
  );
}
