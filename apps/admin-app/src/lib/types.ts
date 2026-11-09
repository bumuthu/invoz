export const ramisStatuses = ["draft", "validated", "queued", "cleared", "rejected", "skipped_non_vat"] as const;

export type RamisStatusName = (typeof ramisStatuses)[number];

export type StatusCounts = Record<RamisStatusName, number> & { total: number };

export type Range = "month" | "all";

export type OrganizationSummary = {
  id: string;
  name: string;
  slug: string;
  allowance: number;
  used: number;
  counts: StatusCounts;
};

export type Overview = {
  range: Range;
  totals: StatusCounts;
  organizations: OrganizationSummary[];
};

export type BranchView = { id: string; code: string; name: string };

export type LegalEntityView = {
  id: string;
  name: string;
  tin: string;
  vatNumber: string | null;
  ramisEnabled: boolean;
  certificateOnFile: boolean;
  counts: StatusCounts;
  branches: BranchView[];
};

export type MemberView = { id: string; email: string; name: string; role: string };

export type ConnectionRow = {
  organizationId: string;
  organization: string;
  slug: string;
  legalEntityId: string;
  legalEntity: string;
  tin: string;
  ramisEnabled: boolean;
  certificateOnFile: boolean;
  mode: string | null;
  erp: string | null;
  label: string | null;
  status: string | null;
  endpoint: string | null;
  lastPolled: string | null;
  lastError: string | null;
};

export type OrganizationDetail = OrganizationSummary & {
  pollingEnabled: boolean;
  hasSftpPassword: boolean;
  entities: LegalEntityView[];
  members: MemberView[];
  connections: ConnectionRow[];
};

export type RequestView = {
  id: string;
  organizationId: string;
  organization: string;
  slug: string;
  mode: string;
  erp: string;
  label: string | null;
  endpoint: string | null;
  connectionStatus: string;
  action: string;
  requester: string;
  createdAt: string;
  hasSftpPassword: boolean;
};

export type LeadView = {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  erp: string;
  note: string | null;
  createdAt: string;
};

export type IssuedPassword = {
  host: string | null;
  username: string;
  password: string;
  note: string | null;
};

export type ActionResult = {
  ok: boolean;
  error?: string;
  id?: string;
  issued?: IssuedPassword | null;
  message?: string | null;
};

export type OnboardInput = {
  name: string;
  slug: string;
  allowance: number;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
  entities: Array<{
    name: string;
    tin: string;
    vatNumber: string;
    branches: Array<{ code: string; name: string }>;
  }>;
};
