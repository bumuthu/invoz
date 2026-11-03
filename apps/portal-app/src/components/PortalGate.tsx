"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { unstable_rethrow, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import AppLoading from "@/components/AppLoading";
import AppShell from "@/components/AppShell";
import Logo from "@/components/Logo";
import { clearOrganization, fetchShell, onPortalReload } from "@/lib/portal-client";

type Shell = Awaited<ReturnType<typeof fetchShell>>;

export default function PortalGate({ children }: { children: ReactNode }) {
  const search = useSearchParams().toString();
  const [shell, setShell] = useState<Shell | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);

  useEffect(() => onPortalReload(() => setGeneration((current) => current + 1)), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const value = await fetchShell(search);
        if (!cancelled) setShell(value);
      } catch (error) {
        unstable_rethrow(error);
        if (!cancelled) {
          setFailure(error instanceof Error ? error.message : "The portal could not be loaded.");
          setShell(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [search, generation]);

  if (failure) {
    return (
      <Box
        role="alert"
        sx={{ minHeight: "100vh", display: "grid", placeItems: "center", px: 3, bgcolor: "background.default" }}
      >
        <Stack spacing={1.5} sx={{ alignItems: "center", maxWidth: 420 }}>
          <Logo height={36} />
          <Typography color="text.secondary" sx={{ textAlign: "center" }}>
            {failure}
          </Typography>
        </Stack>
      </Box>
    );
  }

  if (!shell) return <AppLoading />;

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
      clearOrganization={clearOrganization}
    >
      {children}
    </AppShell>
  );
}
