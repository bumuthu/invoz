import { Suspense } from "react";
import AppLoading from "@/components/AppLoading";
import PortalGate from "@/components/PortalGate";

export const dynamic = "force-dynamic";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<AppLoading />}>
      <PortalGate>{children}</PortalGate>
    </Suspense>
  );
}
