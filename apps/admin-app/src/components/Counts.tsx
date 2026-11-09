import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { StatusCounts } from "@/lib/types";

const count = new Intl.NumberFormat("en-US");

const labels: Array<[keyof StatusCounts, string]> = [
  ["cleared", "Accepted"],
  ["rejected", "Rejected"],
  ["queued", "Queued"],
  ["validated", "Validated"],
  ["draft", "Draft"],
  ["skipped_non_vat", "Skipped"],
  ["total", "Total"],
];

export function formatCount(value: number) {
  return count.format(value);
}

export default function Counts({ counts }: { counts: StatusCounts }) {
  return (
    <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: "wrap" }}>
      {labels.map(([key, label]) => (
        <Stack key={key} spacing={0}>
          <Typography variant="caption" color="text.secondary">
            {label}
          </Typography>
          <Typography sx={{ fontWeight: key === "cleared" || key === "rejected" ? 700 : 500 }}>
            {count.format(counts[key])}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
}
