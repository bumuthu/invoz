"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import LoadState from "@/components/LoadState";
import PageHeader from "@/components/PageHeader";
import { fetchRequests, postJson } from "@/lib/client";
import type { IssuedPassword, RequestView } from "@/lib/types";

export default function RequestsPage() {
  const [issued, setIssued] = useState<IssuedPassword | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState("");

  return (
    <LoadState loadKey="requests" load={fetchRequests}>
      {(requests, reload) => (
        <Stack spacing={3}>
          <PageHeader
            title="Requests"
            description="Approving SFTP issues a password when the organization does not have one yet. Polling approval does not show the API key."
          />
          {issued ? <PasswordAlert issued={issued} /> : null}
          {notice ? <Alert severity="success">{notice}</Alert> : null}
          {error ? <Alert severity="error">{error}</Alert> : null}
          <Queue
            title="SFTP"
            rows={requests.sftp}
            pendingId={pendingId}
            onDecide={async (request, decision) => {
              setPendingId(request.id);
              setError("");
              setNotice("");
              setIssued(null);
              const result = await postJson("requests", { requestId: request.id, decision });
              setPendingId("");
              if (!result.ok) {
                setError(result.error ?? "The request could not be completed.");
                return;
              }
              setIssued(result.issued ?? null);
              setNotice(result.message || `${request.organization} ${decision === "approve" ? "approved" : "rejected"}.`);
              reload();
            }}
          />
          <Queue
            title="ERP polling"
            rows={requests.poll}
            pendingId={pendingId}
            onDecide={async (request, decision) => {
              setPendingId(request.id);
              setError("");
              setNotice("");
              const result = await postJson("requests", { requestId: request.id, decision });
              setPendingId("");
              if (!result.ok) {
                setError(result.error ?? "The request could not be completed.");
                return;
              }
              setNotice(`${request.organization} ${decision === "approve" ? "approved" : "rejected"}.`);
              reload();
            }}
          />
        </Stack>
      )}
    </LoadState>
  );
}

function Queue({
  title,
  rows,
  pendingId,
  onDecide,
}: {
  title: string;
  rows: RequestView[];
  pendingId: string;
  onDecide: (request: RequestView, decision: "approve" | "reject") => Promise<void>;
}) {
  return (
    <Card sx={{ overflow: "auto" }}>
      <Typography sx={{ fontWeight: 700, px: 2, pt: 2 }}>{title}</Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Organization</TableCell>
            <TableCell>ERP</TableCell>
            <TableCell>Action</TableCell>
            <TableCell>Requester</TableCell>
            <TableCell>When</TableCell>
            <TableCell>Password</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7}>No pending requests.</TableCell>
            </TableRow>
          ) : (
            rows.map((request) => (
              <TableRow key={request.id} hover>
                <TableCell>
                  {request.organization}
                  <br />
                  {request.slug}
                </TableCell>
                <TableCell>
                  {request.erp}
                  {request.label ? ` · ${request.label}` : ""}
                  {request.endpoint ? <><br />{request.endpoint}</> : null}
                </TableCell>
                <TableCell>{request.action}</TableCell>
                <TableCell>{request.requester}</TableCell>
                <TableCell>{new Date(request.createdAt).toLocaleString()}</TableCell>
                <TableCell>{request.mode === "sftp" ? (request.hasSftpPassword ? "Issued" : "New") : "—"}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1}>
                    <Button size="small" variant="contained" disabled={pendingId === request.id} onClick={() => onDecide(request, "approve")}>
                      Approve
                    </Button>
                    <Button size="small" variant="outlined" disabled={pendingId === request.id} onClick={() => onDecide(request, "reject")}>
                      Reject
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
}

function PasswordAlert({ issued }: { issued: IssuedPassword }) {
  return (
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
  );
}
