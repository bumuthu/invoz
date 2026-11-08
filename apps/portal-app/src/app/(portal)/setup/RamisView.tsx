"use client";

import Alert from "@mui/material/Alert";
import Card from "@mui/material/Card";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { reloadPortal, setRamisEnabled } from "@/lib/portal-client";
import type { LegalEntitySetup } from "@/lib/types";

export default function RamisView({
  entities,
  organizationId,
  canChange,
}: {
  entities: LegalEntitySetup[];
  organizationId: string;
  canChange: boolean;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  async function toggle(entity: LegalEntitySetup, enabled: boolean) {
    setPending(entity.id);
    const result = await setRamisEnabled(organizationId, entity.id, enabled);
    setPending(null);
    if (!result.ok) {
      setMessage({ tone: "error", text: result.error });
      return;
    }
    setMessage({ tone: "success", text: result.message });
    reloadPortal();
  }

  return (
    <>
      <PageHeader
        title="RAMIS Connection"
        description="Choose which legal entities file to RAMIS. A disabled legal entity is skipped when invoices are submitted."
      />
      {message ? (
        <Alert severity={message.tone} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      ) : null}
      {entities.length === 0 ? (
        <Typography color="text.secondary">This organization has no legal entities yet.</Typography>
      ) : (
        <Card>
          {entities.map((entity, index) => (
            <Stack
              key={entity.id}
              direction="row"
              sx={{
                justifyContent: "space-between",
                alignItems: "center",
                gap: 2,
                px: 2.5,
                py: 2,
                borderTop: index === 0 ? 0 : 1,
                borderColor: "divider",
              }}
            >
              <Stack>
                <Typography sx={{ fontWeight: 600 }}>{entity.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  TIN {entity.tin}
                  {entity.vatNumber ? ` · VAT ${entity.vatNumber}` : ""}
                </Typography>
              </Stack>
              <FormControlLabel
                label={entity.ramisEnabled ? "Enabled" : "Disabled"}
                control={
                  <Switch
                    checked={entity.ramisEnabled}
                    disabled={!canChange || pending !== null}
                    onChange={(event) => void toggle(entity, event.target.checked)}
                    slotProps={{ input: { "aria-label": `${entity.name} RAMIS connection` } }}
                  />
                }
              />
            </Stack>
          ))}
        </Card>
      )}
      {canChange ? null : (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          View only
        </Typography>
      )}
    </>
  );
}
