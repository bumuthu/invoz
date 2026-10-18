"use client";

import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import type { FieldMappingView } from "@/lib/types";

export default function MappingView({
  fieldMappings,
  targetFields,
}: {
  fieldMappings: FieldMappingView[];
  targetFields: string[];
}) {
  const sourceColumns = fieldMappings.map((row) => row.source);
  const [mapping, setMapping] = useState(fieldMappings.map((row) => row.target));

  return (
    <>
      <PageHeader
        title="Field mapping"
        description="Map this legal entity's export columns once. Later files use the same profile."
      />
      <Card>
        <CardContent>
          <Stack spacing={1.5}>
            {sourceColumns.map((column, index) => (
              <Stack
                key={column}
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
                sx={{ alignItems: { sm: "center" } }}
              >
                <Typography sx={{ flex: 1 }}>{column}</Typography>
                <TextField
                  select
                  size="small"
                  label="Portal field"
                  value={mapping[index]}
                  onChange={(event) => {
                    const next = [...mapping];
                    next[index] = event.target.value;
                    setMapping(next);
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
            ))}
          </Stack>
        </CardContent>
      </Card>
    </>
  );
}
