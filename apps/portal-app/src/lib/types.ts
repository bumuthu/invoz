import type { PortalRole } from "@invoz/common";

export type InvoiceStatus = "Cleared" | "Rejected" | "Submitting" | "Skipped";

export type DocumentKind = "Tax invoice" | "Credit note" | "Debit note";

export type DocumentSource = "invoice" | "adjustment";

export type ScheduleFilter = "all" | "01" | "02" | "04";

export type PortalFilters = {
  entityId: string;
  branch: string;
  period: string;
  schedule: ScheduleFilter;
  status: "all" | InvoiceStatus;
};

export type Invoice = {
  id: string;
  source: DocumentSource;
  sourceId: string;
  serial: string;
  buyer: string;
  buyerTin: string;
  invoiceDate: string;
  supplyDate: string;
  amount: string;
  vat: string;
  total: string;
  status: InvoiceStatus;
  branch: string;
  entity: string;
  entityId: string;
  kind: DocumentKind;
  schedule: "01" | "04";
  note?: string;
  token?: string;
  parentSerial?: string;
  parentDate?: string;
  reason?: string;
  tags: string[];
};

export type PortalUser = {
  name: string;
  email: string;
  role: PortalRole;
};

export type BranchView = {
  id: string;
  code: string;
  name: string;
  entityId: string;
  entity: string;
  nextSerial: string;
};

export type ScheduleRow = {
  id: string;
  supplier: string;
  tin: string;
  serial: string;
  amount: string;
  vat: string;
  voucher: string | null;
  match: "matched" | "discrepancy" | "unmatched";
  approved: boolean;
  invoiceDate: string;
  entity: string;
};

export type FieldMappingView = {
  source: string;
  target: string;
  entityId: string;
};

export type EntityOption = {
  id: string;
  name: string;
  tin: string;
};

export type OrganizationOption = {
  id: string;
  name: string;
};

export type GapRow = {
  period: string;
  branch: string;
  from: string;
  to: string;
  issued: number;
  missing: string[];
};

export type AuditEvent = {
  id: string;
  at: string;
  event: string;
  document: string;
};

export type EntityHealth = {
  id: string;
  name: string;
  tin: string;
  rejected: number;
  unapprovedInput: number;
  clearanceRate: string;
  selected: boolean;
};

export type DailyPoint = {
  label: string;
  count: number;
};

export type TaxSlice = {
  label: string;
  amount: string;
  share: string;
};

export type OverviewMetrics = {
  outputVat: string;
  inputVat: string;
  adjustmentVat: string;
  netVat: string;
  clearanceRate: string;
  inFlight: number;
  rejected: number;
  inputAtRisk: string;
  creditNoteRatio: string;
  creditNoteElevated: boolean;
  taxMix: TaxSlice[];
  daily: DailyPoint[];
  dueLabel: string;
  seriesLabel: string;
};

export type PipelineCounts = {
  cleared: number;
  submitting: number;
  rejected: number;
  skipped: number;
};

export type PortalData = {
  organization: {
    id: string;
    name: string;
    slug: string;
    host: string;
    monthlyAllowance: number;
  };
  organizations: OrganizationOption[];
  hostPinned: boolean;
  currentUser: {
    name: string;
    email: string;
    role: string;
    roleKey: PortalRole;
  };
  canApprove: boolean;
  canRequeue: boolean;
  canMap: boolean;
  canAudit: boolean;
  users: PortalUser[];
  usage: {
    clearedCount: number;
    monthLabel: string;
  };
  entities: EntityOption[];
  branches: BranchView[];
  periods: string[];
  filters: PortalFilters;
  query: string;
  fieldMappings: FieldMappingView[];
  targetFields: string[];
  invoices: Invoice[];
  recent: Invoice[];
  rejected: Invoice[];
  scheduleRows: ScheduleRow[];
  gaps: GapRow[];
  auditEvents: AuditEvent[];
  health: EntityHealth[];
  metrics: OverviewMetrics;
  pipeline: PipelineCounts;
};
