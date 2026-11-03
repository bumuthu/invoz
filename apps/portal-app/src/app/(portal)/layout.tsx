import { Suspense } from "react";
import AppLoading from "@/components/AppLoading";
import PortalGate from "@/components/PortalGate";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<AppLoading />}>
      <PortalGate>{children}</PortalGate>
    </Suspense>
  );
}
