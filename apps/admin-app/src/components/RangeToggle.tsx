"use client";

import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import type { Range } from "@/lib/types";

export default function RangeToggle({ value, onChange }: { value: Range; onChange: (range: Range) => void }) {
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={value}
      onChange={(_event, next: Range | null) => {
        if (next) onChange(next);
      }}
    >
      <ToggleButton value="month">This month</ToggleButton>
      <ToggleButton value="all">All time</ToggleButton>
    </ToggleButtonGroup>
  );
}
