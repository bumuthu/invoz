import type {
  AuditLog,
  Branch,
  FieldMapping,
  InboundAdjustment,
  InboundInvoice,
  InvoiceUsage,
  LegalEntity,
  Membership,
  Organization,
  OutboundAdjustment,
  OutboundInvoice,
  RamisCredential,
  SerialCounter,
} from "../entities";
import type {
  AuditLogRow,
  BranchRow,
  FieldMappingRow,
  InboundAdjustmentRow,
  InboundInvoiceRow,
  InvoiceUsageRow,
  LegalEntityRow,
  MembershipRow,
  OrganizationRow,
  OutboundAdjustmentRow,
  OutboundInvoiceRow,
  RamisCredentialRow,
  SerialCounterRow,
} from "./rows";

export function toOrganization(row: OrganizationRow): Organization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    monthlyAllowance: row.monthly_allowance,
    createdAt: row.created_at,
  };
}

export function toLegalEntity(row: LegalEntityRow): LegalEntity {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    tin: row.tin,
    vatNumber: row.vat_number,
    createdAt: row.created_at,
  };
}

export function toBranch(row: BranchRow): Branch {
  return {
    id: row.id,
    legalEntityId: row.legal_entity_id,
    code: row.code,
    name: row.name,
    createdAt: row.created_at,
  };
}

export function toMembership(row: MembershipRow): Membership {
  return {
    id: row.id,
    userId: row.user_id,
    organizationId: row.organization_id,
    role: row.role,
    createdAt: row.created_at,
  };
}

export function toFieldMapping(row: FieldMappingRow): FieldMapping {
  return {
    id: row.id,
    legalEntityId: row.legal_entity_id,
    sourceColumn: row.source_column,
    targetField: row.target_field,
  };
}

export function toRamisCredential(row: RamisCredentialRow): RamisCredential {
  return {
    legalEntityId: row.legal_entity_id,
    certificateSecretArn: row.certificate_secret_arn,
    updatedAt: row.updated_at,
  };
}

export function toSerialCounter(row: SerialCounterRow): SerialCounter {
  return {
    branchId: row.branch_id,
    legalEntityId: row.legal_entity_id,
    period: row.period,
    lastValue: row.last_value,
  };
}

export function toOutboundInvoice(row: OutboundInvoiceRow): OutboundInvoice {
  return {
    id: row.id,
    organizationId: row.organization_id,
    legalEntityId: row.legal_entity_id,
    branchId: row.branch_id,
    serialNumber: row.serial_number,
    erpReference: row.erp_reference,
    invoiceType: row.invoice_type,
    invoiceDate: row.invoice_date,
    supplyDate: row.supply_date,
    customerTin: row.customer_tin,
    customerName: row.customer_name,
    customerAddress: row.customer_address,
    placeOfSupply: row.place_of_supply,
    currency: row.currency,
    exchangeRate: row.exchange_rate,
    amountExclusiveVat: row.amount_exclusive_vat,
    vatRate: row.vat_rate,
    vatAmount: row.vat_amount,
    totalAmount: row.total_amount,
    ramisStatus: row.ramis_status,
    ramisClearanceToken: row.ramis_clearance_token,
    ramisPayloadHash: row.ramis_payload_hash,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    clearedAt: row.cleared_at,
  };
}

export function toOutboundAdjustment(row: OutboundAdjustmentRow): OutboundAdjustment {
  return {
    id: row.id,
    organizationId: row.organization_id,
    legalEntityId: row.legal_entity_id,
    branchId: row.branch_id,
    serialNumber: row.serial_number,
    adjustmentType: row.adjustment_type,
    erpReference: row.erp_reference,
    originalInvoiceId: row.original_invoice_id,
    originalSerialNumber: row.original_serial_number,
    originalInvoiceDate: row.original_invoice_date,
    reason: row.reason,
    adjustmentDate: row.adjustment_date,
    adjustedAmountExclusiveVat: row.adjusted_amount_exclusive_vat,
    adjustedVatAmount: row.adjusted_vat_amount,
    adjustedTotalAmount: row.adjusted_total_amount,
    ramisStatus: row.ramis_status,
    ramisClearanceToken: row.ramis_clearance_token,
    ramisPayloadHash: row.ramis_payload_hash,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    clearedAt: row.cleared_at,
  };
}

export function toInboundInvoice(row: InboundInvoiceRow): InboundInvoice {
  return {
    id: row.id,
    organizationId: row.organization_id,
    legalEntityId: row.legal_entity_id,
    supplierTin: row.supplier_tin,
    supplierName: row.supplier_name,
    supplierInvoiceNumber: row.supplier_invoice_number,
    invoiceDate: row.invoice_date,
    amountExclusiveVat: row.amount_exclusive_vat,
    vatAmount: row.vat_amount,
    totalAmount: row.total_amount,
    erpVoucherReference: row.erp_voucher_reference,
    matchingStatus: row.matching_status,
    isApprovedForInputVat: row.is_approved_for_input_vat,
    approvedAt: row.approved_at,
    approvedBy: row.approved_by,
    pulledAt: row.pulled_at,
  };
}

export function toInboundAdjustment(row: InboundAdjustmentRow): InboundAdjustment {
  return {
    id: row.id,
    organizationId: row.organization_id,
    legalEntityId: row.legal_entity_id,
    supplierTin: row.supplier_tin,
    supplierName: row.supplier_name,
    adjustmentSerialNumber: row.adjustment_serial_number,
    adjustmentType: row.adjustment_type,
    originalInvoiceNumber: row.original_invoice_number,
    adjustmentDate: row.adjustment_date,
    adjustedAmountExclusiveVat: row.adjusted_amount_exclusive_vat,
    adjustedVatAmount: row.adjusted_vat_amount,
    matchingStatus: row.matching_status,
    isApproved: row.is_approved,
    approvedAt: row.approved_at,
    approvedBy: row.approved_by,
    pulledAt: row.pulled_at,
  };
}

export function toInvoiceUsage(row: InvoiceUsageRow): InvoiceUsage {
  return {
    organizationId: row.organization_id,
    period: row.period,
    clearedCount: row.cleared_count,
  };
}

export function toAuditLog(row: AuditLogRow): AuditLog {
  return {
    id: row.id,
    organizationId: row.organization_id,
    legalEntityId: row.legal_entity_id,
    outboundInvoiceId: row.outbound_invoice_id,
    outboundAdjustmentId: row.outbound_adjustment_id,
    inboundInvoiceId: row.inbound_invoice_id,
    inboundAdjustmentId: row.inbound_adjustment_id,
    event: row.event,
    detail: row.detail,
    createdAt: row.created_at,
  };
}
