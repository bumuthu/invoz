"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { portalRoleLabel, portalRoles, type PortalRole } from "@invoz/common";
import Initials from "@/components/Initials";
import PageHeader from "@/components/PageHeader";
import { inviteMember } from "@/lib/actions";
import type { PortalUser } from "@/lib/types";

const roles = portalRoles.filter((item) => item !== "owner");

export default function UsersView({
  users,
  organizationId,
  canInvite,
}: {
  users: PortalUser[];
  organizationId: string;
  canInvite: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<PortalRole>("viewer");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string; link?: string } | null>(null);

  return (
    <>
      <PageHeader
        title="Users"
        description="The owner or an admin invites people onto this organization. The role sets what they can do across every legal entity and branch."
      />
      {message ? (
        <Alert severity={message.tone} sx={{ mb: 2 }}>
          {message.text}
          {message.link ? (
            <Typography variant="body2" sx={{ mt: 1, wordBreak: "break-all" }}>
              {message.link}
            </Typography>
          ) : null}
        </Alert>
      ) : null}
      {canInvite ? (
        <Card sx={{ mb: 2 }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            sx={{ p: 2, alignItems: { md: "center" } }}
          >
            <TextField
              label="Email"
              size="small"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              sx={{ flex: 1 }}
            />
            <TextField
              select
              label="Role"
              size="small"
              value={role}
              onChange={(event) => setRole(event.target.value as PortalRole)}
              sx={{ minWidth: 160 }}
            >
              {roles.map((item) => (
                <MenuItem key={item} value={item}>
                  {portalRoleLabel(item)}
                </MenuItem>
              ))}
            </TextField>
            <Button
              variant="contained"
              disabled={pending || email.trim() === ""}
              onClick={async () => {
                setPending(true);
                const result = await inviteMember(organizationId, email, role);
                setPending(false);
                if (!result.ok) {
                  setMessage({ tone: "error", text: result.error });
                  return;
                }
                setEmail("");
                setMessage({ tone: "success", text: result.message, link: result.inviteUrl });
                router.refresh();
              }}
            >
              Invite
            </Button>
          </Stack>
        </Card>
      ) : (
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Only the owner or an admin can invite people.
        </Typography>
      )}
      <Card>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.email} hover>
                <TableCell>
                  <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
                    <Initials name={user.name} />
                    <Box>{user.name}</Box>
                  </Stack>
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{portalRoleLabel(user.role)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
