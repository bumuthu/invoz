"use client";

import Card from "@mui/material/Card";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { useMemo, useState } from "react";
import InvoiceTable from "@/components/InvoiceTable";
import PageHeader from "@/components/PageHeader";
import type { Invoice, InvoiceStatus } from "@/lib/types";

const filters = ["All", "Cleared", "Submitting", "Rejected", "Skipped"] as const;

export default function InvoicesView({ invoices }: { invoices: Invoice[] }) {
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const rows = useMemo(
    () =>
      filter === "All"
        ? invoices
        : invoices.filter((invoice) => invoice.status === (filter as InvoiceStatus)),
    [filter, invoices],
  );

  return (
    <>
      <PageHeader
        title="Invoices"
        description="Schedule 01 tax invoices and Schedule 04 credit notes for this legal entity."
      />
      <ToggleButtonGroup
        exclusive
        size="small"
        value={filter}
        onChange={(_, value: (typeof filters)[number] | null) => {
          if (value) setFilter(value);
        }}
        aria-label="Filter invoices by status"
        sx={{ mb: 2.5, flexWrap: "wrap" }}
      >
        {filters.map((item) => (
          <ToggleButton key={item} value={item}>
            {item}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <Card>
        <InvoiceTable rows={rows} />
      </Card>
    </>
  );
}
