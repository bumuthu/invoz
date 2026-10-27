"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { saveFieldMappings } from "@/lib/actions";
import type { FieldMappingView } from "@/lib/types";

export default function MappingView({
  fieldMappings,
  targetFields,
  organizationId,
  entityId,
  canMap,
}: {
  fieldMappings: FieldMappingView[];
  targetFields: string[];
  organizationId: string;
  entityId: string | null;
  canMap: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(fieldMappings.map((row) => ({ source: row.source, target: row.target })));
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  return (
    <>
      <PageHeader
        title="Field mapping"
        description="Match this legal entity's export columns to the portal fields. Later files use the saved profile."
        action={
          <Button
            variant="contained"
            disabled={!canMap || !entityId || pending}
            onClick={async () => {
              if (!entityId) return;
              setPending(true);
              const result = await saveFieldMappings(organizationId, entityId, rows);
              setPending(false);
              if (!result.ok) {
                setMessage({ tone: "error", text: result.error });
                return;
              }
              setMessage({ tone: "success", text: result.message });
              router.refresh();
            }}
          >
            Save mapping
          </Button>
        }
      />
      {!entityId ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          Choose one legal entity before saving a mapping.
        </Alert>
      ) : null}
      {!canMap ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          Your role can view the mapping and cannot change it.
        </Alert>
      ) : null}
      {message ? (
        <Alert severity={message.tone} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      ) : null}
      <Card>
        <CardContent>
          <Stack spacing={1.5}>
            {rows.length === 0 ? (
              <Typography color="text.secondary">No columns mapped for this entity.</Typography>
            ) : (
              rows.map((row, index) => (
                <Stack
                  key={row.source}
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.5}
                  sx={{ alignItems: { sm: "center" } }}
                >
                  <Typography sx={{ flex: 1 }}>{row.source}</Typography>
                  <TextField
                    select
                    size="small"
                    label="Portal field"
                    value={targetFields.includes(row.target) ? row.target : targetFields[0]}
                    disabled={!canMap || !entityId}
                    onChange={(event) => {
                      const next = [...rows];
                      next[index] = { ...row, target: event.target.value };
                      setRows(next);
                    }}
                    sx={{ minWidth: { sm: 220 } }}
                  >
                    {targetFields.map((field) => (
                      <MenuItem key={field} value={field}>
                        {field}
                      </MenuItem>
                    ))}
                  </TextField>
                </Stack>
              ))
            )}
          </Stack>
        </CardContent>
      </Card>
    </>
  );
}
