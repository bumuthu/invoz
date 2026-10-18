"use client";

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
import { useState } from "react";
import { portalRoleLabel, portalRoles, type PortalRole } from "@ramis/common";
import Initials from "@/components/Initials";
import PageHeader from "@/components/PageHeader";
import type { PortalUser } from "@/lib/types";

const roles = portalRoles.filter((item) => item !== "owner");

export default function UsersView({ users }: { users: PortalUser[] }) {
  const [rows, setRows] = useState(users);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<PortalRole>("viewer");

  return (
    <>
      <PageHeader
        title="Users"
        description="The owner invites people onto this organization. The role sets what they can do across every legal entity and branch."
      />
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
            onClick={() => {
              if (!email.trim()) return;
              setRows((current) => [
                ...current,
                { name: email.split("@")[0], email, role },
              ]);
              setEmail("");
            }}
          >
            Invite
          </Button>
        </Stack>
      </Card>
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
            {rows.map((user) => (
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
