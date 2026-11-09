"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useParams } from "next/navigation";
import { useState } from "react";
import ConnectionTable from "@/components/ConnectionTable";
import Counts, { formatCount } from "@/components/Counts";
import LoadState from "@/components/LoadState";
import PageHeader from "@/components/PageHeader";
import RangeToggle from "@/components/RangeToggle";
import { fetchOrganization, postJson } from "@/lib/client";
import type { IssuedPassword, Range } from "@/lib/types";

export default function OrganizationPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [range, setRange] = useState<Range>("month");
  return (
    <LoadState loadKey={`${id}:${range}`} load={() => fetchOrganization(id, range)}>
      {(organization, reload) => <OrganizationBody organization={organization} range={range} onRange={setRange} reload={reload} />}
    </LoadState>
  );
}

function OrganizationBody({
  organization,
  range,
  onRange,
  reload,
}: {
  organization: NonNullable<Awaited<ReturnType<typeof fetchOrganization>>>;
  range: Range;
  onRange: (range: Range) => void;
  reload: () => void;
}) {
  const [name, setName] = useState(organization.name);
  const [allowance, setAllowance] = useState(String(organization.allowance));
  const [entityName, setEntityName] = useState("");
  const [tin, setTin] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [branchDrafts, setBranchDrafts] = useState<Record<string, { code: string; name: string }>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [issued, setIssued] = useState<IssuedPassword | null>(null);
  const [pending, setPending] = useState(false);

  async function run(action: () => Promise<{ ok: boolean; error?: string; issued?: IssuedPassword | null; message?: string | null }>) {
    setPending(true);
    setError("");
    setMessage("");
    const result = await action();
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? "The change could not be saved.");
      return;
    }
    setIssued(result.issued ?? null);
    setMessage(result.message || "Saved.");
    reload();
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        title={organization.name}
        description={`${organization.slug} · polling ${organization.pollingEnabled ? "on" : "off"}`}
        action={<RangeToggle value={range} onChange={onRange} />}
      />
      {message ? <Alert severity="success">{message}</Alert> : null}
      {error ? <Alert severity="error">{error}</Alert> : null}
      {issued ? (
        <Alert severity="warning">
          Copy this password now. It is not shown again.
          <br />
          Host: {issued.host ?? "unavailable"}
          <br />
          Username: {issued.username}
          <br />
          Password: {issued.password}
          {issued.note ? <><br />{issued.note}</> : null}
        </Alert>
      ) : null}
      <Card>
        <CardContent>
          <Typography sx={{ fontWeight: 700, mb: 1.5 }}>Invoices</Typography>
          <Counts counts={organization.counts} />
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Stack spacing={2} component="form" onSubmit={(event) => {
            event.preventDefault();
            void run(() => postJson("organization-name", { id: organization.id, name }));
          }}>
            <Typography sx={{ fontWeight: 700 }}>Name</Typography>
            <TextField label="Organization name" value={name} onChange={(event) => setName(event.target.value)} />
            <Button type="submit" variant="contained" disabled={pending} sx={{ alignSelf: "flex-start" }}>Save name</Button>
          </Stack>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Stack spacing={2} component="form" onSubmit={(event) => {
            event.preventDefault();
            void run(() => postJson("allowance", { id: organization.id, allowance: Number(allowance) }));
          }}>
            <Typography sx={{ fontWeight: 700 }}>Subscription</Typography>
            <Typography color="text.secondary">
              This month: {formatCount(organization.used)} cleared of {formatCount(organization.allowance)} allowed. The portal shows this allowance and cannot change it.
            </Typography>
            <TextField label="Monthly allowance" type="number" value={allowance} onChange={(event) => setAllowance(event.target.value)} inputProps={{ min: 1 }} />
            <Button type="submit" variant="contained" disabled={pending} sx={{ alignSelf: "flex-start" }}>Save allowance</Button>
          </Stack>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Stack spacing={1}>
            <Typography sx={{ fontWeight: 700 }}>SFTP password</Typography>
            <Typography color="text.secondary">
              {organization.hasSftpPassword ? "A password is already stored. Rotate replaces it." : "No password yet. Approve the SFTP enable request to issue one."}
            </Typography>
            <Button
              variant="outlined"
              disabled={pending || !organization.hasSftpPassword}
              sx={{ alignSelf: "flex-start" }}
              onClick={() => void run(() => postJson("sftp-password", { organizationId: organization.id }))}
            >
              Rotate password
            </Button>
          </Stack>
        </CardContent>
      </Card>
      <Card sx={{ overflow: "auto" }}>
        <Typography sx={{ fontWeight: 700, px: 2, pt: 2 }}>Legal entities</Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Entity</TableCell>
              <TableCell>Accepted</TableCell>
              <TableCell>Rejected</TableCell>
              <TableCell>RAMIS</TableCell>
              <TableCell>Branch</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {organization.entities.map((entity) => {
              const draft = branchDrafts[entity.id] ?? { code: "", name: "" };
              return (
                <TableRow key={entity.id}>
                  <TableCell>
                    {entity.name}
                    <Typography variant="caption" display="block" color="text.secondary">
                      TIN {entity.tin}{entity.vatNumber ? ` · VAT ${entity.vatNumber}` : ""}
                    </Typography>
                    {entity.branches.map((branch) => (
                      <Typography key={branch.id} variant="caption" display="block">
                        {branch.code} · {branch.name}
                      </Typography>
                    ))}
                  </TableCell>
                  <TableCell>{formatCount(entity.counts.cleared)}</TableCell>
                  <TableCell>{formatCount(entity.counts.rejected)}</TableCell>
                  <TableCell>
                    <Switch
                      checked={entity.ramisEnabled}
                      disabled={pending}
                      onChange={(event) => void run(() => postJson("ramis", { legalEntityId: entity.id, enabled: event.target.checked }))}
                    />
                    {entity.certificateOnFile ? "Certificate on file" : "No certificate"}
                  </TableCell>
                  <TableCell>
                    <Stack spacing={1}>
                      <TextField size="small" label="Code" value={draft.code} onChange={(event) => setBranchDrafts((current) => ({ ...current, [entity.id]: { ...draft, code: event.target.value } }))} />
                      <TextField size="small" label="Name" value={draft.name} onChange={(event) => setBranchDrafts((current) => ({ ...current, [entity.id]: { ...draft, name: event.target.value } }))} />
                      <Button size="small" variant="outlined" disabled={pending} onClick={() => void run(async () => {
                        const result = await postJson("branches", { legalEntityId: entity.id, code: draft.code, name: draft.name });
                        if (result.ok) setBranchDrafts((current) => ({ ...current, [entity.id]: { code: "", name: "" } }));
                        return result;
                      })}>
                        Add branch
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <CardContent>
          <Stack spacing={2} component="form" onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              const result = await postJson("legal-entities", { organizationId: organization.id, name: entityName, tin, vatNumber });
              if (result.ok) {
                setEntityName("");
                setTin("");
                setVatNumber("");
              }
              return result;
            });
          }}>
            <Typography sx={{ fontWeight: 700 }}>Add legal entity</Typography>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField label="Name" value={entityName} onChange={(event) => setEntityName(event.target.value)} required />
              <TextField label="TIN" value={tin} onChange={(event) => setTin(event.target.value)} required />
              <TextField label="VAT number" value={vatNumber} onChange={(event) => setVatNumber(event.target.value)} />
            </Stack>
            <Button type="submit" variant="outlined" disabled={pending} sx={{ alignSelf: "flex-start" }}>Add legal entity</Button>
          </Stack>
        </CardContent>
      </Card>
      <Card>
        <Typography sx={{ fontWeight: 700, px: 2, pt: 2 }}>Members</Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {organization.members.map((member) => (
              <TableRow key={member.id}>
                <TableCell>{member.name}</TableCell>
                <TableCell>{member.email}</TableCell>
                <TableCell>{member.role}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <Card sx={{ overflow: "auto" }}>
        <Typography sx={{ fontWeight: 700, px: 2, pt: 2, pb: 1 }}>Connections</Typography>
        <ConnectionTable rows={organization.connections} showOrganization={false} />
      </Card>
    </Stack>
  );
}
