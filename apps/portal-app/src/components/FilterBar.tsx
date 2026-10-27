"use client";

import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { usePathname, useRouter } from "next/navigation";
import { periodLabel } from "@/lib/filters";
import type { BranchView, EntityOption, OrganizationOption, PortalFilters } from "@/lib/types";

const fieldSx = { minWidth: { md: 0 }, flex: { md: 1 } };

export default function FilterBar({
  filters,
  entities,
  branches,
  periods,
  organizations,
  organizationId,
  showOrganization,
}: {
  filters: PortalFilters;
  entities: EntityOption[];
  branches: BranchView[];
  periods: string[];
  organizations: OrganizationOption[];
  organizationId: string;
  showOrganization: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const branchOptions =
    filters.entityId === "all" ? branches : branches.filter((branch) => branch.entityId === filters.entityId);
  const branchValue = branchOptions.some((branch) => branch.id === filters.branch) ? filters.branch : "all";

  function push(next: Partial<PortalFilters> & { org?: string }) {
    const params = new URLSearchParams();
    const org = next.org ?? (showOrganization ? organizationId : "");
    const entityId = next.entityId ?? filters.entityId;
    const branch = next.branch ?? branchValue;
    const period = next.period ?? filters.period;
    const schedule = next.schedule ?? filters.schedule;
    const status = next.status ?? filters.status;
    if (org) params.set("org", org);
    if (entityId !== "all") params.set("entity", entityId);
    if (branch !== "all") params.set("branch", branch);
    if (period !== "all") params.set("period", period);
    if (schedule !== "all") params.set("schedule", schedule);
    if (status !== "all") params.set("status", status);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <Stack
      direction={{ xs: "column", lg: "row" }}
      spacing={1.25}
      className="no-print"
      sx={{
        p: 1.5,
        mb: 2.5,
        border: 1,
        borderColor: "divider",
        borderRadius: 3,
        bgcolor: "background.paper",
      }}
    >
      {showOrganization ? (
        <TextField
          select
          size="small"
          label="Organization"
          value={organizationId}
          onChange={(event) => push({ org: event.target.value, entityId: "all", branch: "all" })}
          sx={fieldSx}
        >
          {organizations.map((organization) => (
            <MenuItem key={organization.id} value={organization.id}>
              {organization.name}
            </MenuItem>
          ))}
        </TextField>
      ) : null}
      <TextField
        select
        size="small"
        label="Legal entity"
        value={entities.some((entity) => entity.id === filters.entityId) ? filters.entityId : "all"}
        onChange={(event) => push({ entityId: event.target.value, branch: "all" })}
        sx={fieldSx}
      >
        <MenuItem value="all">All entities</MenuItem>
        {entities.map((entity) => (
          <MenuItem key={entity.id} value={entity.id}>
            {entity.name} · {entity.tin}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        size="small"
        label="Branch"
        value={branchValue}
        onChange={(event) => push({ branch: event.target.value })}
        sx={fieldSx}
      >
        <MenuItem value="all">All branches</MenuItem>
        {branchOptions.map((branch) => (
          <MenuItem key={branch.id} value={branch.id}>
            {branch.code} · {branch.name}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        size="small"
        label="Taxable period"
        value={periods.includes(filters.period) ? filters.period : "all"}
        onChange={(event) => push({ period: event.target.value })}
        sx={fieldSx}
      >
        <MenuItem value="all">All periods</MenuItem>
        {periods.map((period) => (
          <MenuItem key={period} value={period}>
            {periodLabel(period)}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        size="small"
        label="Schedule"
        value={filters.schedule}
        onChange={(event) => push({ schedule: event.target.value as PortalFilters["schedule"] })}
        sx={fieldSx}
      >
        <MenuItem value="all">All schedules</MenuItem>
        <MenuItem value="01">Schedule 01 sales</MenuItem>
        <MenuItem value="02">Schedule 02 purchases</MenuItem>
        <MenuItem value="04">Schedule 04 adjustments</MenuItem>
      </TextField>
      <TextField
        select
        size="small"
        label="Status"
        value={filters.status}
        onChange={(event) => push({ status: event.target.value as PortalFilters["status"] })}
        sx={fieldSx}
      >
        <MenuItem value="all">All</MenuItem>
        <MenuItem value="Cleared">Cleared</MenuItem>
        <MenuItem value="Submitting">Queued</MenuItem>
        <MenuItem value="Rejected">Exceptions</MenuItem>
        <MenuItem value="Skipped">Skipped</MenuItem>
      </TextField>
    </Stack>
  );
}
