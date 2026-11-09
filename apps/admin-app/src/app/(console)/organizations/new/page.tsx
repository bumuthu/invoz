"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useRouter } from "next/navigation";
import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { postJson } from "@/lib/client";

type Branch = { code: string; name: string };
type Entity = { name: string; tin: string; vatNumber: string; branches: Branch[] };

const emptyBranch = (): Branch => ({ code: "", name: "" });
const emptyEntity = (): Entity => ({ name: "", tin: "", vatNumber: "", branches: [emptyBranch()] });

export default function NewOrganizationPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [allowance, setAllowance] = useState("500");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [entities, setEntities] = useState<Entity[]>([emptyEntity()]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  function updateEntity(index: number, patch: Partial<Entity>) {
    setEntities((current) => current.map((entity, entityIndex) => (entityIndex === index ? { ...entity, ...patch } : entity)));
  }

  return (
    <Stack spacing={3} component="form" onSubmit={async (event) => {
      event.preventDefault();
      setPending(true);
      setError("");
      const result = await postJson("organizations", {
        name,
        slug,
        allowance: Number(allowance),
        ownerName,
        ownerEmail,
        ownerPassword,
        entities,
      });
      setPending(false);
      if (!result.ok || !result.id) {
        setError(result.error ?? "The organization was not created.");
        return;
      }
      router.push(`/organizations/${result.id}`);
    }}>
      <PageHeader
        title="New organization"
        description="Creates the organization, its legal entities, branches, and the owner login. It does not write a seeder folder."
      />
      {error ? <Alert severity="error">{error}</Alert> : null}
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography sx={{ fontWeight: 700 }}>Organization</Typography>
            <TextField label="Name" value={name} onChange={(event) => setName(event.target.value)} required />
            <TextField label="Slug" value={slug} onChange={(event) => setSlug(event.target.value)} required helperText="Lowercase letters, digits, and hyphens. Not www, admin, app, or api." />
            <TextField label="Monthly allowance" type="number" value={allowance} onChange={(event) => setAllowance(event.target.value)} required inputProps={{ min: 1 }} />
          </Stack>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography sx={{ fontWeight: 700 }}>Owner</Typography>
            <TextField label="Name" value={ownerName} onChange={(event) => setOwnerName(event.target.value)} required />
            <TextField label="Email" type="email" value={ownerEmail} onChange={(event) => setOwnerEmail(event.target.value)} required />
            <TextField label="Initial password" type="password" value={ownerPassword} onChange={(event) => setOwnerPassword(event.target.value)} required helperText="At least 8 characters. An existing account that belongs to no organization keeps its password." />
          </Stack>
        </CardContent>
      </Card>
      {entities.map((entity, index) => (
        <Card key={index}>
          <CardContent>
            <Stack spacing={2}>
              <Typography sx={{ fontWeight: 700 }}>Legal entity {index + 1}</Typography>
              <TextField label="Name" value={entity.name} onChange={(event) => updateEntity(index, { name: event.target.value })} required />
              <TextField label="TIN" value={entity.tin} onChange={(event) => updateEntity(index, { tin: event.target.value })} required helperText="9 digits" />
              <TextField label="VAT number" value={entity.vatNumber} onChange={(event) => updateEntity(index, { vatNumber: event.target.value })} />
              {entity.branches.map((branch, branchIndex) => (
                <Stack key={branchIndex} direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField label="Branch code" value={branch.code} onChange={(event) => {
                    const branches = entity.branches.map((item, itemIndex) => itemIndex === branchIndex ? { ...item, code: event.target.value } : item);
                    updateEntity(index, { branches });
                  }} required />
                  <TextField label="Branch name" value={branch.name} onChange={(event) => {
                    const branches = entity.branches.map((item, itemIndex) => itemIndex === branchIndex ? { ...item, name: event.target.value } : item);
                    updateEntity(index, { branches });
                  }} required fullWidth />
                </Stack>
              ))}
              <Button variant="outlined" onClick={() => updateEntity(index, { branches: [...entity.branches, emptyBranch()] })}>
                Add branch
              </Button>
            </Stack>
          </CardContent>
        </Card>
      ))}
      <Stack direction="row" spacing={2}>
        <Button variant="outlined" onClick={() => setEntities((current) => [...current, emptyEntity()])}>
          Add legal entity
        </Button>
        <Button type="submit" variant="contained" disabled={pending}>
          {pending ? "Creating" : "Create organization"}
        </Button>
      </Stack>
    </Stack>
  );
}
