import type { PortalRole } from "@ramis/common";

export type InvoiceStatus = "Cleared" | "Rejected" | "Submitting" | "Skipped";

export type Invoice = {
  id: string;
  serial: string;
  buyer: string;
  buyerTin: string;
  invoiceDate: string;
  supplyDate: string;
  amount: string;
  vat: string;
  status: InvoiceStatus;
  branch: string;
  entity: string;
  kind: "Tax invoice" | "Credit note";
  note?: string;
};

export type PortalUser = {
  name: string;
  email: string;
  role: PortalRole;
};

export type BranchView = {
  code: string;
  name: string;
  nextSerial: string;
};

export type ScheduleRow = {
  id: string;
  supplier: string;
  tin: string;
  serial: string;
  amount: string;
  vat: string;
  matched: string;
};

export type FieldMappingView = {
  source: string;
  target: string;
};

export type PortalData = {
  organization: {
    name: string;
    slug: string;
    host: string;
    entity: string;
    tin: string;
    monthlyAllowance: number;
  };
  currentUser: {
    name: string;
    email: string;
    role: string;
  };
  users: PortalUser[];
  usage: {
    clearedCount: number;
    monthLabel: string;
  };
  branches: BranchView[];
  fieldMappings: FieldMappingView[];
  targetFields: string[];
  invoices: Invoice[];
  scheduleRows: ScheduleRow[];
};
