"use client";

import Card from "@mui/material/Card";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import LoadState from "@/components/LoadState";
import PageHeader from "@/components/PageHeader";
import { fetchLeads } from "@/lib/client";

export default function LeadsPage() {
  return (
    <LoadState loadKey="leads" load={fetchLeads}>
      {(leads) => (
        <>
          <PageHeader title="Leads" description="Demo requests from the public site." />
          <Card sx={{ overflow: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>When</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell>Company</TableCell>
                  <TableCell>ERP</TableCell>
                  <TableCell>Note</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {leads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7}>No demo requests yet.</TableCell>
                  </TableRow>
                ) : (
                  leads.map((lead) => (
                    <TableRow key={lead.id} hover>
                      <TableCell>{new Date(lead.createdAt).toLocaleString()}</TableCell>
                      <TableCell>{lead.name}</TableCell>
                      <TableCell>{lead.email}</TableCell>
                      <TableCell>{lead.phone}</TableCell>
                      <TableCell>{lead.company}</TableCell>
                      <TableCell>{lead.erp}</TableCell>
                      <TableCell>{lead.note ?? "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </LoadState>
  );
}
