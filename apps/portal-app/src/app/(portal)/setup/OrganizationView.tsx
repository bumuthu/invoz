"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
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
import { createBranch, createLegalEntity, reloadPortal } from "@/lib/portal-client";
import type { BranchView, LegalEntitySetup } from "@/lib/types";

type DialogKind = null | "entity" | "branch";

export default function OrganizationView({
  entities,
  branches,
  organizationId,
  canChange,
}: {
  entities: LegalEntitySetup[];
  branches: BranchView[];
  organizationId: string;
  canChange: boolean;
}) {
  const [pending, setPending] = useState<"entity" | "branch" | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [tin, setTin] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [legalEntityId, setLegalEntityId] = useState(entities[0]?.id ?? "");
  const [branchCode, setBranchCode] = useState("");
  const [branchName, setBranchName] = useState("");
  const selectedEntityId = entities.some((entity) => entity.id === legalEntityId)
    ? legalEntityId
    : (entities[0]?.id ?? "");

  function openDialog(kind: Exclude<DialogKind, null>) {
    setDialogError(null);
    setName("");
    setTin("");
    setVatNumber("");
    setBranchCode("");
    setBranchName("");
    setLegalEntityId(entities[0]?.id ?? "");
    setDialog(kind);
  }

  function closeDialog() {
    if (pending !== null) return;
    setDialog(null);
    setDialogError(null);
  }

  async function addEntity() {
    setPending("entity");
    setDialogError(null);
    const result = await createLegalEntity({
      organizationId,
      name,
      tin,
      vatNumber: vatNumber.trim() ? vatNumber : null,
    });
    setPending(null);
    if (!result.ok) {
      setDialogError(result.error);
      return;
    }
    setDialog(null);
    setMessage({ tone: "success", text: result.message });
    reloadPortal();
  }

  async function addBranch() {
    setPending("branch");
    setDialogError(null);
    const result = await createBranch({
      organizationId,
      legalEntityId: selectedEntityId,
      code: branchCode,
      name: branchName,
    });
    setPending(null);
    if (!result.ok) {
      setDialogError(result.error);
      return;
    }
    setDialog(null);
    setMessage({ tone: "success", text: result.message });
    reloadPortal();
  }

  return (
    <>
      <PageHeader
        title="Organization Settings"
        description="Add legal entities and branches for this organization. A new legal entity stays disabled for RAMIS until you enable it."
      />
      {message ? (
        <Alert severity={message.tone} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      ) : null}

      <SectionTitle
        title="Legal entities"
        action={canChange ? "Add legal entity" : null}
        onAction={() => openDialog("entity")}
      />
      <Card sx={{ mb: 4 }}>
        {entities.length === 0 ? (
          <Typography color="text.secondary" sx={{ px: 2.5, py: 2 }}>
            No legal entities yet.
          </Typography>
        ) : (
          entities.map((entity, index) => (
            <Stack
              key={entity.id}
              direction="row"
              sx={{
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 2,
                px: 2.5,
                py: 2,
                borderTop: index === 0 ? 0 : 1,
                borderColor: "divider",
              }}
            >
              <Box>
                <Typography sx={{ fontWeight: 600 }}>{entity.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  TIN {entity.tin}
                  {entity.vatNumber ? ` · VAT ${entity.vatNumber}` : ""}
                </Typography>
              </Box>
              <Typography variant="body2" color={entity.ramisEnabled ? "success.main" : "text.secondary"}>
                {entity.ramisEnabled ? "RAMIS enabled" : "RAMIS disabled"}
              </Typography>
            </Stack>
          ))
        )}
      </Card>

      <SectionTitle
        title="Branches"
        action={canChange ? "Add branch" : null}
        disabled={entities.length === 0}
        onAction={() => openDialog("branch")}
      />
      <Card>
        {branches.length === 0 ? (
          <Typography color="text.secondary" sx={{ px: 2.5, py: 2 }}>
            No branches yet.
          </Typography>
        ) : (
          branches.map((branch, index) => (
            <Stack
              key={branch.id}
              direction="row"
              sx={{
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 2,
                px: 2.5,
                py: 2,
                borderTop: index === 0 ? 0 : 1,
                borderColor: "divider",
              }}
            >
              <Box>
                <Typography sx={{ fontWeight: 600 }}>{branch.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {branch.entity} · {branch.code}
                </Typography>
              </Box>
              <Typography sx={{ fontWeight: 600, color: "primary.main" }}>{branch.nextSerial}</Typography>
            </Stack>
          ))
        )}
      </Card>
      {canChange ? null : (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          View only
        </Typography>
      )}

      <Dialog open={dialog === "entity"} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>Add legal entity</DialogTitle>
        <DialogContent>
          <Stack sx={{ gap: 2, pt: 1 }}>
            {dialogError ? <Alert severity="error">{dialogError}</Alert> : null}
            <Typography variant="body2" color="text.secondary">
              A new legal entity stays disabled for RAMIS until you enable it.
            </Typography>
            <TextField label="Legal entity name" value={name} onChange={(event) => setName(event.target.value)} />
            <TextField label="TIN" value={tin} onChange={(event) => setTin(event.target.value)} helperText="9 digits" />
            <TextField
              label="VAT number"
              value={vatNumber}
              onChange={(event) => setVatNumber(event.target.value)}
              helperText="Optional"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={pending !== null}>
            Cancel
          </Button>
          <Button variant="contained" disabled={pending !== null} onClick={() => void addEntity()}>
            Add legal entity
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialog === "branch"} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>Add branch</DialogTitle>
        <DialogContent>
          <Stack sx={{ gap: 2, pt: 1 }}>
            {dialogError ? <Alert severity="error">{dialogError}</Alert> : null}
            <TextField
              select
              label="Legal entity"
              value={selectedEntityId}
              onChange={(event) => setLegalEntityId(event.target.value)}
              disabled={entities.length === 0}
            >
              {entities.map((entity) => (
                <MenuItem key={entity.id} value={entity.id}>
                  {entity.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Branch code"
              value={branchCode}
              onChange={(event) => setBranchCode(event.target.value)}
              helperText="1 to 15 letters or digits"
            />
            <TextField label="Branch name" value={branchName} onChange={(event) => setBranchName(event.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={pending !== null}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={pending !== null || entities.length === 0}
            onClick={() => void addBranch()}
          >
            Add branch
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function SectionTitle({
  title,
  action,
  disabled = false,
  onAction,
}: {
  title: string;
  action: string | null;
  disabled?: boolean;
  onAction: () => void;
}) {
  return (
    <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", gap: 2, mb: 1.5 }}>
      <Typography variant="h6">{title}</Typography>
      {action ? (
        <Button variant="contained" disabled={disabled} onClick={onAction} sx={{ flexShrink: 0 }}>
          {action}
        </Button>
      ) : null}
    </Stack>
  );
}
