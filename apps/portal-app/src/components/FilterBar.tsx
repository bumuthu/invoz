"use client";

import Divider from "@mui/material/Divider";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { periodLabel } from "@/lib/filters";
import type { BranchView, EntityOption, OrganizationOption, PortalFilters } from "@/lib/types";

const fieldSx = {
  minWidth: { md: 0 },
  flex: { md: 1 },
  "& .MuiInputLabel-root": {
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: "0.01em",
  },
  "& .MuiInputBase-root": {
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: "-0.011em",
    color: "text.primary",
  },
  "& .MuiSelect-select": {
    fontWeight: 600,
    py: "7.5px",
  },
};

const selectSlotProps = {
  select: {
    MenuProps: {
      slotProps: {
        list: {
          sx: {
            py: 0.5,
            "& .MuiMenuItem-root": {
              fontSize: 13,
              fontWeight: 600,
              minHeight: 34,
            },
          },
        },
      },
    },
  },
};

export default function FilterBar({
  filters,
  entities,
  branches,
  periods,
  organizations,
  organizationId,
  showOrganization,
  account,
}: {
  filters: PortalFilters;
  entities: EntityOption[];
  branches: BranchView[];
  periods: string[];
  organizations: OrganizationOption[];
  organizationId: string;
  showOrganization: boolean;
  account?: ReactNode;
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
      direction={{ xs: "column", md: "row" }}
      className="no-print"
      sx={{
        alignItems: "stretch",
        border: 1,
        borderColor: "divider",
        borderRadius: 3,
        bgcolor: "background.paper",
        overflow: "hidden",
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1.5}
        sx={{ flex: 1, minWidth: 0, px: 2.25, py: 2 }}
      >
      {showOrganization ? (
        <TextField
          select
          size="small"
          label="Organization"
          value={organizationId}
          onChange={(event) => push({ org: event.target.value, entityId: "all", branch: "all" })}
          sx={fieldSx}
          slotProps={selectSlotProps}
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
        slotProps={selectSlotProps}
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
        slotProps={selectSlotProps}
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
        slotProps={selectSlotProps}
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
        slotProps={selectSlotProps}
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
        slotProps={selectSlotProps}
      >
        <MenuItem value="all">All</MenuItem>
        <MenuItem value="Cleared">Cleared</MenuItem>
        <MenuItem value="Submitting">Queued</MenuItem>
        <MenuItem value="Rejected">Exceptions</MenuItem>
        <MenuItem value="Skipped">Skipped</MenuItem>
      </TextField>
      </Stack>
      {account ? (
        <Stack
          direction="row"
          sx={{
            display: { xs: "none", md: "flex" },
            alignItems: "stretch",
            flexShrink: 0,
          }}
        >
          <Divider orientation="vertical" flexItem />
          <Stack sx={{ justifyContent: "center", px: 1.75 }}>{account}</Stack>
        </Stack>
      ) : null}
    </Stack>
  );
}
