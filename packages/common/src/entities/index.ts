export const portalRoles = ["owner", "admin", "manager", "staff", "viewer"] as const;
export type PortalRole = (typeof portalRoles)[number];

export const invoiceClasses = [
  "standard",
  "financial_services",
  "zero_rated",
  "exempt",
] as const;
export type InvoiceClass = (typeof invoiceClasses)[number];

export const adjustmentTypes = ["credit_note", "debit_note"] as const;
export type AdjustmentType = (typeof adjustmentTypes)[number];

export const ramisStatuses = [
  "draft",
  "validated",
  "queued",
  "cleared",
  "rejected",
  "skipped_non_vat",
] as const;
export type RamisStatus = (typeof ramisStatuses)[number];

export const matchingStatuses = ["unmatched", "matched", "discrepancy"] as const;
export type MatchingStatus = (typeof matchingStatuses)[number];

export type RowId = number;

export type Organization = {
  id: RowId;
  name: string;
  slug: string;
  monthlyAllowance: number;
  createdAt: string;
};

export type LegalEntity = {
  id: RowId;
  organizationId: RowId;
  name: string;
  tin: string;
  vatNumber: string | null;
  createdAt: string;
};

export type Branch = {
  id: RowId;
  legalEntityId: RowId;
  code: string;
  name: string;
  createdAt: string;
};

export type Membership = {
  id: RowId;
  userId: string;
  organizationId: RowId;
  role: PortalRole;
  createdAt: string;
};

export type FieldMapping = {
  id: RowId;
  legalEntityId: RowId;
  sourceColumn: string;
  targetField: string;
};

export type RamisCredential = {
  legalEntityId: RowId;
  certificateSecretArn: string;
  updatedAt: string;
};

export type SerialCounter = {
  branchId: RowId;
  legalEntityId: RowId;
  period: string;
  lastValue: number;
};

export type OutboundInvoice = {
  id: RowId;
  organizationId: RowId;
  legalEntityId: RowId;
  branchId: RowId;
  serialNumber: string | null;
  erpReference: string;
  invoiceType: InvoiceClass;
  invoiceDate: string;
  supplyDate: string;
  customerTin: string;
  customerName: string;
  customerAddress: string | null;
  placeOfSupply: string | null;
  currency: string;
  exchangeRate: string;
  amountExclusiveVat: string;
  vatRate: string;
  vatAmount: string;
  totalAmount: string;
  ramisStatus: RamisStatus;
  ramisClearanceToken: string | null;
  ramisPayloadHash: string;
  errorMessage: string | null;
  createdAt: string;
  clearedAt: string | null;
};

export type OutboundAdjustment = {
  id: RowId;
  organizationId: RowId;
  legalEntityId: RowId;
  branchId: RowId;
  serialNumber: string | null;
  adjustmentType: AdjustmentType;
  erpReference: string;
  originalInvoiceId: RowId;
  originalSerialNumber: string;
  originalInvoiceDate: string;
  reason: string;
  adjustmentDate: string;
  adjustedAmountExclusiveVat: string;
  adjustedVatAmount: string;
  adjustedTotalAmount: string;
  ramisStatus: RamisStatus;
  ramisClearanceToken: string | null;
  ramisPayloadHash: string;
  errorMessage: string | null;
  createdAt: string;
  clearedAt: string | null;
};

export type InboundInvoice = {
  id: RowId;
  organizationId: RowId;
  legalEntityId: RowId;
  supplierTin: string;
  supplierName: string;
  supplierInvoiceNumber: string;
  invoiceDate: string;
  amountExclusiveVat: string;
  vatAmount: string;
  totalAmount: string;
  erpVoucherReference: string | null;
  matchingStatus: MatchingStatus;
  isApprovedForInputVat: boolean;
  approvedAt: string | null;
  approvedBy: string | null;
  pulledAt: string;
};

export type InboundAdjustment = {
  id: RowId;
  organizationId: RowId;
  legalEntityId: RowId;
  supplierTin: string;
  supplierName: string;
  adjustmentSerialNumber: string;
  adjustmentType: AdjustmentType;
  originalInvoiceNumber: string;
  adjustmentDate: string;
  adjustedAmountExclusiveVat: string;
  adjustedVatAmount: string;
  matchingStatus: MatchingStatus;
  isApproved: boolean;
  approvedAt: string | null;
  approvedBy: string | null;
  pulledAt: string;
};

export type InvoiceUsage = {
  organizationId: RowId;
  period: string;
  clearedCount: number;
};

export type AuditLog = {
  id: RowId;
  organizationId: RowId;
  legalEntityId: RowId | null;
  outboundInvoiceId: RowId | null;
  outboundAdjustmentId: RowId | null;
  inboundInvoiceId: RowId | null;
  inboundAdjustmentId: RowId | null;
  event: string;
  detail: Record<string, unknown>;
  createdAt: string;
};
