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
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useState, type ReactNode } from "react";
import PageHeader from "@/components/PageHeader";
import { canPollErp } from "@/lib/erps";
import { reloadPortal, requestErpChange, requestPoll, requestSftp } from "@/lib/portal-client";
import type { ErpConnectionView, ErpOption } from "@/lib/types";

type DialogState = null | { kind: "sftp" } | { kind: "poll"; connectionId: string | null };

export default function ErpView({
  catalog,
  connections,
  organizationId,
  canConnect,
  pollingEnabled,
}: {
  catalog: ErpOption[];
  connections: ErpConnectionView[];
  organizationId: string;
  canConnect: boolean;
  pollingEnabled: boolean;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [dialogKind, setDialogKind] = useState<"sftp" | "poll">("sftp");
  const [details, setDetails] = useState<ErpConnectionView | null>(null);
  const [erpCode, setErpCode] = useState(catalog[0]?.code ?? "");
  const [label, setLabel] = useState("");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [lastInvoiceId, setLastInvoiceId] = useState("");
  const sftpConnections = connections.filter((item) => item.ingestionMode === "sftp");
  const pollConnections = connections.filter((item) => item.ingestionMode === "poll");
  const pollCatalog = catalog.filter((erp) => canPollErp(erp.code));
  const requestedPollCodes = new Set(pollConnections.map((item) => item.code));
  const availablePoll = pollCatalog.filter((erp) => !requestedPollCodes.has(erp.code));

  function openDialog(next: DialogState, current?: ErpConnectionView) {
    setErpCode(
      next?.kind === "poll"
        ? (current?.code ?? availablePoll[0]?.code ?? "")
        : (catalog[0]?.code ?? ""),
    );
    setLabel(current?.label ?? "");
    setEndpointUrl(current?.endpointUrl ?? "");
    setApiKey("");
    setLastInvoiceId(current?.lastInvoiceId ?? "");
    if (next) setDialogKind(next.kind);
    setDialog(next);
  }

  async function submitRequest() {
    if (!dialog) return;
    setPending("request");
    const result =
      dialog.kind === "sftp"
        ? await requestSftp(organizationId, erpCode)
        : await requestPoll({
            organizationId,
            erpCode,
            label,
            endpointUrl,
            apiKey,
            lastInvoiceId: lastInvoiceId || null,
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
        description="SFTP and polling belong to the organization. Choose the ERP in the request, then wait for it to be approved."
      />
      {message ? (
        <Alert severity={message.tone} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      ) : null}

      <Section title="SFTP">
        <ConnectionList
          connections={sftpConnections}
          empty="No SFTP integration yet."
          pending={pending}
          canConnect={canConnect}
          onOpen={setDetails}
          onChange={requestChange}
        />
        <ConfigureCard
          text={
            sftpConnections.length > 0
              ? "This organization already has an SFTP integration."
              : "Upload invoice files over SFTP. The integration stays offline until the request is approved."
          }
          erps={catalog}
          showAction={canConnect}
          disabled={pending !== null || sftpConnections.length > 0}
          onConfigure={() => openDialog({ kind: "sftp" })}
        />
      </Section>

      <Section title="Polling">
        <Alert severity={pollingEnabled ? "success" : "info"} sx={{ mb: 2 }}>
          {pollingEnabled
            ? "Polling is on for this organization. A polling integration still waits until its enable request is approved."
            : "Polling is off for this organization. A polling request stays idle until polling is turned on."}
        </Alert>
        <ConnectionList
          connections={pollConnections}
          empty="No polling integration yet."
          pending={pending}
          canConnect={canConnect}
          onOpen={setDetails}
          onChange={requestChange}
        />
        <ConfigureCard
          text={
            availablePoll.length === 0
              ? "Every polling ERP has already been requested."
              : "Each ERP can have one polling request. It stays offline until the request is approved."
          }
          erps={pollCatalog}
          disabledCodes={requestedPollCodes}
          showAction={canConnect}
          disabled={pending !== null || availablePoll.length === 0}
          onConfigure={() => openDialog({ kind: "poll", connectionId: null })}
        />
      </Section>

      {canConnect ? null : (
        <Typography variant="body2" color="text.secondary">
          View only
        </Typography>
      )}

      <Dialog open={details !== null} onClose={() => setDetails(null)} fullWidth maxWidth="sm">
        <DialogTitle>{details ? details.label || details.name : "Integration"}</DialogTitle>
        <DialogContent>{details ? <IntegrationDetails item={details} /> : null}</DialogContent>
        <DialogActions>
          <Button onClick={() => setDetails(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialog !== null} onClose={() => setDialog(null)} fullWidth maxWidth="sm">
        <DialogTitle>{dialogKind === "poll" ? "Configure polling" : "Configure SFTP"}</DialogTitle>
        <DialogContent>
          <Stack sx={{ gap: 2, pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              This sends a request. The integration stays offline until it is approved.
            </Typography>
            <TextField
              select
              label="ERP"
              value={erpCode}
              onChange={(event) => setErpCode(event.target.value)}
              disabled={dialogKind === "poll" && dialog?.kind === "poll" && dialog.connectionId !== null}
            >
              {(dialogKind === "poll" ? pollCatalog : catalog).map((erp) => {
                const requested = dialogKind === "poll" && requestedPollCodes.has(erp.code);
                return (
                  <MenuItem key={erp.code} value={erp.code} disabled={requested}>
                    {requested ? `${erp.name} — requested` : erp.name}
                  </MenuItem>
                );
              })}
            </TextField>
            {dialogKind === "poll" ? (
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
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={pending !== null || (dialogKind === "poll" && requestedPollCodes.has(erpCode) && dialog?.kind === "poll" && dialog.connectionId === null)}
            onClick={submitRequest}
          >
            Send request
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h6" sx={{ mb: 1.5 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function ConfigureCard({
  text,
  erps,
  disabledCodes,
  showAction,
  disabled,
  onConfigure,
}: {
  text: string;
  erps: ErpOption[];
  disabledCodes?: Set<string>;
  showAction: boolean;
  disabled: boolean;
  onConfigure: () => void;
}) {
  return (
    <Card>
      <CardContent sx={{ px: 3, py: 2.5, "&:last-child": { pb: 2.5 } }}>
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", gap: 2 }}>
          <Stack sx={{ gap: 1.25, minWidth: 0 }}>
            <Typography color="text.secondary">{text}</Typography>
            <ErpMarks erps={erps} disabledCodes={disabledCodes} />
          </Stack>
          {showAction ? (
            <Button variant="contained" disabled={disabled} onClick={onConfigure} sx={{ flexShrink: 0 }}>
              Configure
            </Button>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}

function ConnectionList({
  connections,
  empty,
  pending,
  canConnect,
  onOpen,
  onChange,
}: {
  connections: ErpConnectionView[];
  empty: string;
  pending: string | null;
  canConnect: boolean;
  onOpen: (item: ErpConnectionView) => void;
  onChange: (item: ErpConnectionView) => void;
}) {
  if (connections.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        {empty}
      </Typography>
    );
  }
  return (
    <Stack sx={{ gap: 2, mb: 2 }}>
      {connections.map((item) => {
        const live = item.status === "live";
        return (
          <Card
            key={item.id}
            onClick={() => onOpen(item)}
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
                  <Stack direction="row" sx={{ alignItems: "center", gap: 1.25 }}>
                    <ErpMark code={item.code} name={item.name} />
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>
                      {item.name}
                    </Typography>
                  </Stack>
                  {item.label ? (
                    <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                      {item.label}
                    </Typography>
                  ) : null}
                  <Typography variant="body2" sx={{ mt: 1.5 }}>
                    {item.endpointUrl ? item.endpointUrl : item.ingestionMode === "poll" ? "Polling" : "SFTP"}
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
                        onChange(item);
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
    </Stack>
  );
}

function IntegrationDetails({ item }: { item: ErpConnectionView }) {
  const polling = item.ingestionMode === "poll";
  const rows = [
    ["ERP", item.name],
    ["Method", polling ? "Polling" : "SFTP"],
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

const erpMarks: Record<string, { label: string; background: string; color: string }> = {
  s4hana: { label: "S4", background: "#0070C0", color: "#fff" },
  sap_ecc: { label: "ECC", background: "#003366", color: "#fff" },
  sap_b1: { label: "B1", background: "#F0AB00", color: "#1A1A1A" },
  ifs: { label: "IFS", background: "#E2231A", color: "#fff" },
  dynamics: { label: "D365", background: "#002050", color: "#fff" },
  business_central: { label: "BC", background: "#00A1F1", color: "#fff" },
  oracle: { label: "ORC", background: "#C74634", color: "#fff" },
  netsuite: { label: "NS", background: "#1F4E79", color: "#fff" },
  odoo: { label: "Odoo", background: "#714B67", color: "#fff" },
  nav: { label: "NAV", background: "#5C2D91", color: "#fff" },
};

function ErpMarks({ erps, disabledCodes }: { erps: ErpOption[]; disabledCodes?: Set<string> }) {
  return (
    <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75 }} aria-label="Supported ERPs">
      {erps.map((erp) => (
        <ErpMark key={erp.code} code={erp.code} name={erp.name} disabled={disabledCodes?.has(erp.code) ?? false} />
      ))}
    </Stack>
  );
}

function ErpMark({ code, name, disabled = false }: { code: string; name: string; disabled?: boolean }) {
  const mark = erpMarks[code] ?? { label: name.slice(0, 3).toUpperCase(), background: "#5C6B73", color: "#fff" };
  return (
    <Tooltip title={disabled ? `${name} — requested` : name}>
      <Box
        component="span"
        role="img"
        aria-label={disabled ? `${name}, requested` : name}
        sx={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: 28,
          height: 28,
          px: 0.75,
          borderRadius: 1,
          bgcolor: mark.background,
          color: mark.color,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.02em",
          lineHeight: 1,
          flexShrink: 0,
          opacity: disabled ? 0.35 : 1,
        }}
      >
        {mark.label}
      </Box>
    </Tooltip>
  );
}
