"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { canPollErp } from "@/lib/erps";
import { reloadPortal, requestErpChange, requestPoll, requestSftp } from "@/lib/portal-client";
import type { EntityOption, ErpConnectionView, ErpOption } from "@/lib/types";

type DialogState =
  | null
  | { kind: "sftp" }
  | { kind: "poll"; code: string; name: string; connectionId: string | null };

export default function ErpView({
  catalog,
  connections,
  entities,
  organizationId,
  canConnect,
  pollingEnabled,
}: {
  catalog: ErpOption[];
  connections: ErpConnectionView[];
  entities: EntityOption[];
  organizationId: string;
  canConnect: boolean;
  pollingEnabled: boolean;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [details, setDetails] = useState<ErpConnectionView | null>(null);
  const [erpCode, setErpCode] = useState(catalog[0]?.code ?? "");
  const [label, setLabel] = useState("");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [lastInvoiceId, setLastInvoiceId] = useState("");
  const [legalEntityId, setLegalEntityId] = useState("");
  const hasSftp = connections.some((item) => item.ingestionMode === "sftp");
  const pollCatalog = catalog.filter((erp) => canPollErp(erp.code));

  function openDialog(next: DialogState, current?: ErpConnectionView) {
    setErpCode(next?.kind === "poll" ? next.code : (catalog[0]?.code ?? ""));
    setLabel(current?.label ?? "");
    setEndpointUrl(current?.endpointUrl ?? "");
    setApiKey("");
    setLastInvoiceId(current?.lastInvoiceId ?? "");
    setLegalEntityId(current?.entityId ?? "");
    setDialog(next);
  }

  async function submitRequest() {
    if (!dialog) return;
    setPending("request");
    const result =
      dialog.kind === "sftp"
        ? await requestSftp(organizationId, erpCode, legalEntityId || null)
        : await requestPoll({
            organizationId,
            erpCode: dialog.code,
            label,
            endpointUrl,
            apiKey,
            lastInvoiceId: lastInvoiceId || null,
            legalEntityId: legalEntityId || null,
            connectionId: dialog.connectionId,
          });
    setPending(null);
    if (!result.ok) {
      setMessage({ tone: "error", text: result.error });
      return;
    }
    setDialog(null);
    setApiKey("");
    setMessage({ tone: "success", text: result.message });
    reloadPortal();
  }

  async function requestChange(item: ErpConnectionView) {
    if (item.ingestionMode === "poll" && item.status !== "live") {
      openDialog({ kind: "poll", code: item.code, name: item.name, connectionId: item.id }, item);
      return;
    }
    const action = item.status === "live" ? "disable" : "enable";
    setPending(item.id);
    const result = await requestErpChange(organizationId, item.id, action);
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
        title="ERP"
        description="SFTP and polling belong to the organization. A legal entity is optional. Polling can use more than one API configuration for the same ERP."
      />
      {message ? (
        <Alert severity={message.tone} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      ) : null}
      <Alert severity={pollingEnabled ? "success" : "info"} sx={{ mb: 2 }}>
        {pollingEnabled
          ? "Polling is on for this organization. A polling integration still waits until its enable request is approved."
          : "Polling is off for this organization. SFTP requests are unchanged, and polling stays idle until polling is turned on."}
      </Alert>

      <Typography variant="h6" sx={{ mb: 1.5 }}>
        Integrations
      </Typography>
      {connections.length === 0 ? (
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          This organization has not requested an integration.
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
          {connections.map((item) => {
            const live = item.status === "live";
            return (
              <Card
                key={item.id}
                onClick={() => setDetails(item)}
                sx={{
                  borderColor: live ? "success.main" : "divider",
                  borderWidth: 1,
                  borderStyle: "solid",
                  cursor: "pointer",
                }}
              >
                <CardContent sx={{ px: 3, py: 3 }}>
                  <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", gap: 2 }}>
                    <Box>
                      <Typography variant="h5" sx={{ fontWeight: 700 }}>
                        {item.label || item.name}
                      </Typography>
                      <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                        {item.label ? `${item.name} · ` : ""}
                        {item.entityName ?? "Organization"}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 1.5 }}>
                        {item.ingestionMode === "poll" ? "Polling" : "SFTP"}
                        {item.endpointUrl ? ` · ${item.endpointUrl}` : ""}
                        {item.lastInvoiceId ? ` · last invoice ${item.lastInvoiceId}` : ""}
                      </Typography>
                      {item.lastError ? (
                        <Typography variant="body2" color="error" sx={{ mt: 0.5 }}>
                          {item.lastError}
                        </Typography>
                      ) : null}
                      {canConnect && !item.pendingRequest ? (
                        <Button
                          size="small"
                          variant="outlined"
                          sx={{ mt: 1.5 }}
                          disabled={pending !== null}
                          onClick={(event) => {
                            event.stopPropagation();
                            void requestChange(item);
                          }}
                        >
                          {live ? "Request disable" : "Request enable"}
                        </Button>
                      ) : null}
                    </Box>
                    <Stack sx={{ alignItems: "flex-end", gap: 1 }}>
                      <Chip label={live ? "Live" : "Offline"} color={live ? "success" : "default"} />
                      {item.pendingRequest ? (
                        <Chip
                          label={item.pendingRequest === "enable" ? "Enable requested" : "Disable requested"}
                          color="warning"
                        />
                      ) : null}
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Box>
      )}

      {canConnect ? (
        <>
          <Typography variant="h6" sx={{ mb: 1.5 }}>
            Request an integration
          </Typography>
          <Stack direction="row" sx={{ mb: 2 }}>
            <Button variant="contained" disabled={pending !== null || hasSftp} onClick={() => openDialog({ kind: "sftp" })}>
              {hasSftp ? "SFTP requested" : "Request SFTP"}
            </Button>
          </Stack>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              gap: 2,
            }}
          >
            {pollCatalog.map((erp) => (
              <Card key={erp.code}>
                <CardContent>
                  <Typography sx={{ fontWeight: 700 }}>{erp.name}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Polling
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    sx={{ mt: 1.5 }}
                    disabled={pending !== null}
                    onClick={() => openDialog({ kind: "poll", code: erp.code, name: erp.name, connectionId: null })}
                  >
                    Add API configuration
                  </Button>
                </CardContent>
              </Card>
            ))}
          </Box>
        </>
      ) : (
        <Typography variant="body2" color="text.secondary">
          View only
        </Typography>
      )}

      <Dialog open={details !== null} onClose={() => setDetails(null)} fullWidth maxWidth="sm">
        <DialogTitle>{details ? details.label || details.name : "Integration"}</DialogTitle>
        <DialogContent>
          {details ? <IntegrationDetails item={details} /> : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetails(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialog !== null} onClose={() => setDialog(null)} fullWidth maxWidth="sm">
        <DialogTitle>{dialog?.kind === "poll" ? `Request ${dialog.name} polling` : "Request SFTP"}</DialogTitle>
        <DialogContent>
          <Stack sx={{ gap: 2, pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              This sends a request. The integration stays offline until it is approved.
            </Typography>
            {dialog?.kind === "sftp" ? (
              <TextField select label="ERP" value={erpCode} onChange={(event) => setErpCode(event.target.value)}>
                {catalog.map((erp) => (
                  <MenuItem key={erp.code} value={erp.code}>
                    {erp.name}
                  </MenuItem>
                ))}
              </TextField>
            ) : (
              <>
                <TextField label="Configuration name" value={label} onChange={(event) => setLabel(event.target.value)} />
                <TextField
                  label="Billing document API"
                  placeholder="https://host/sap/opu/odata/sap/API_BILLING_DOCUMENT_SRV"
                  value={endpointUrl}
                  onChange={(event) => setEndpointUrl(event.target.value)}
                  helperText="SAP API_BILLING_DOCUMENT_SRV, or the IFS billing API."
                />
                <TextField
                  label="API key"
                  type="password"
                  autoComplete="new-password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  helperText="Sent as the APIKey header. The card shows it masked."
                />
                <TextField
                  label="Start after billing document"
                  value={lastInvoiceId}
                  onChange={(event) => setLastInvoiceId(event.target.value)}
                  helperText="Optional. Documents at or before this id are not submitted."
                />
              </>
            )}
            <TextField
              select
              label="Legal entity"
              value={legalEntityId}
              onChange={(event) => setLegalEntityId(event.target.value)}
            >
              <MenuItem value="">Organization only</MenuItem>
              {entities.map((entity) => (
                <MenuItem key={entity.id} value={entity.id}>
                  {entity.name}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)}>Cancel</Button>
          <Button variant="contained" disabled={pending !== null} onClick={submitRequest}>
            Send request
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function IntegrationDetails({ item }: { item: ErpConnectionView }) {
  const polling = item.ingestionMode === "poll";
  const rows = [
    ["ERP", item.name],
    ["Method", polling ? "Polling" : "SFTP"],
    ["Legal entity", item.entityName ?? "Organization"],
    ["Status", item.status === "live" ? "Live" : "Offline"],
    [
      "Request",
      item.pendingRequest === "enable"
        ? "Enable requested"
        : item.pendingRequest === "disable"
          ? "Disable requested"
          : "None",
    ],
    ...(polling
      ? [
          ["Billing document API", item.endpointUrl ?? "Not set"],
          ["API key", item.maskedApiKey ?? "Not set"],
          ["Start after billing document", item.lastInvoiceId ?? "Not set"],
        ]
      : []),
    ...(item.lastError ? [["Last error", item.lastError]] : []),
  ];
  return (
    <Stack sx={{ gap: 1.5, pt: 1 }}>
      {rows.map(([label, value]) => (
        <Box key={label}>
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
          <Typography sx={{ overflowWrap: "anywhere" }}>{value}</Typography>
        </Box>
      ))}
    </Stack>
  );
}
