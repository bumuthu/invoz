"use client";

import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Link from "next/link";
import LoadState from "@/components/LoadState";
import PageHeader from "@/components/PageHeader";
import { formatCount } from "@/components/Counts";
import { fetchOrganizations } from "@/lib/client";

export default function OrganizationsPage() {
  return (
    <LoadState loadKey="organizations" load={fetchOrganizations}>
      {(organizations) => (
        <>
          <PageHeader
            title="Organizations"
            description="Open an organization to change its subscription, legal entities, and RAMIS setting."
            action={
              <Button component={Link} href="/organizations/new" variant="contained">
                New organization
              </Button>
            }
          />
          <Card>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Slug</TableCell>
                  <TableCell>Accepted</TableCell>
                  <TableCell>Rejected</TableCell>
                  <TableCell>Allowance</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {organizations.map((organization) => (
                  <TableRow key={organization.id} hover>
                    <TableCell>
                      <Link href={`/organizations/${organization.id}`}>{organization.name}</Link>
                    </TableCell>
                    <TableCell>{organization.slug}</TableCell>
                    <TableCell>{formatCount(organization.counts.cleared)}</TableCell>
                    <TableCell>{formatCount(organization.counts.rejected)}</TableCell>
                    <TableCell>
                      {formatCount(organization.used)} / {formatCount(organization.allowance)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </LoadState>
  );
}
