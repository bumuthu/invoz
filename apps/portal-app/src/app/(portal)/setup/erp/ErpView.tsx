"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { connectErp } from "@/lib/actions";
import type { ErpConnectionView, ErpOption } from "@/lib/types";

export default function ErpView({
  catalog,
  connections,
  connection,
  organizationId,
  entityId,
  canConnect,
}: {
  catalog: ErpOption[];
  connections: ErpConnectionView[];
  connection: ErpConnectionView | null;
  organizationId: string;
  entityId: string | null;
  canConnect: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const connectedCodes = new Set(connections.map((item) => item.code));
  const explore = catalog.filter((erp) => !connectedCodes.has(erp.code));

  async function connect(code: string) {
    if (!entityId) return;
    setPending(code);
    const result = await connectErp(organizationId, entityId, code);
    setPending(null);
    if (!result.ok) {
      setMessage({ tone: "error", text: result.error });
      return;
    }
    setMessage({ tone: "success", text: result.message });
    router.refresh();
  }

  return (
    <>
      <PageHeader
        title="ERP"
        description="The ERP this company has connected, and the other supported systems."
      />
      {message ? (
        <Alert severity={message.tone} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      ) : null}
      {entityId === null && canConnect ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          Select one legal entity before connecting a different ERP.
        </Alert>
      ) : null}

      <Typography variant="h6" sx={{ mb: 1.5 }}>
        Applicable
      </Typography>
      {connections.length === 0 ? (
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          This company has not connected an ERP.
        </Typography>
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gap: 2,
            mb: 4,
          }}
        >
          {connections.map((item) => (
            <Card key={`${item.entityId}:${item.code}`} sx={{ borderColor: "success.main", borderWidth: 1, borderStyle: "solid" }}>
              <CardContent sx={{ px: 3, py: 3 }}>
                <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", gap: 2 }}>
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>
                      {item.name}
                    </Typography>
                    <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                      {item.entityName}
                    </Typography>
                  </Box>
                  <Chip label="Connected" color="success" />
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      <Typography variant="h6" sx={{ mb: 1.5 }}>
        Explore
      </Typography>
      {explore.length === 0 ? (
        <Typography color="text.secondary">Every supported ERP is already connected.</Typography>
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "1fr 1fr 1fr" },
            gap: 2,
          }}
        >
          {explore.map((erp) => (
            <Card key={erp.code}>
              <CardContent>
                <Typography sx={{ fontWeight: 700 }}>{erp.name}</Typography>
                <Chip size="small" label="Available" sx={{ mt: 1.25, mb: 1.5 }} />
                {canConnect && entityId !== null ? (
                  <Button size="small" variant="outlined" disabled={pending !== null} onClick={() => connect(erp.code)}>
                    {connection ? "Replace connection" : "Connect"}
                  </Button>
                ) : null}
                {!canConnect ? (
                  <Typography variant="body2" color="text.secondary">
                    View only
                  </Typography>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </Box>
      )}
    </>
  );
}
