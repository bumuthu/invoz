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

export type Organization = {
  id: string;
  name: string;
  slug: string;
  monthlyAllowance: number;
  createdAt: string;
};

export type LegalEntity = {
  id: string;
  organizationId: string;
  name: string;
  tin: string;
  vatNumber: string | null;
  createdAt: string;
};

export type Branch = {
  id: string;
  legalEntityId: string;
  code: string;
  name: string;
  createdAt: string;
};

export type Membership = {
  id: string;
  userId: string;
  organizationId: string;
  role: PortalRole;
  createdAt: string;
};

export type FieldMapping = {
  id: string;
  legalEntityId: string;
  sourceColumn: string;
  targetField: string;
};

export type RamisCredential = {
  legalEntityId: string;
  certificateSecretArn: string;
  updatedAt: string;
};

export type SerialCounter = {
  branchId: string;
  legalEntityId: string;
  period: string;
  lastValue: number;
};

export type OutboundInvoice = {
  id: string;
  organizationId: string;
  legalEntityId: string;
  branchId: string;
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
  id: string;
  organizationId: string;
  legalEntityId: string;
  branchId: string;
  serialNumber: string | null;
  adjustmentType: AdjustmentType;
  erpReference: string;
  originalInvoiceId: string;
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
  id: string;
  organizationId: string;
  legalEntityId: string;
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
  id: string;
  organizationId: string;
  legalEntityId: string;
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
  organizationId: string;
  period: string;
  clearedCount: number;
};

export type AuditLog = {
  id: string;
  organizationId: string;
  legalEntityId: string | null;
  outboundInvoiceId: string | null;
  outboundAdjustmentId: string | null;
  inboundInvoiceId: string | null;
  inboundAdjustmentId: string | null;
  event: string;
  detail: Record<string, unknown>;
  createdAt: string;
};
