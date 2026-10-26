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
  Prisma,
  RamisCredential,
  SerialCounter,
} from "@prisma/client";
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
} from "@invoz/common";

function id(value: bigint): number {
  return Number(value);
}

function day(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function stamp(value: Date): string {
  return value.toISOString();
}

function money(value: Prisma.Decimal, scale = 2): string {
  return value.toFixed(scale);
}

export function organizationRow(row: Organization): OrganizationRow {
  return {
    id: id(row.id),
    name: row.name,
    slug: row.slug,
    monthly_allowance: row.monthly_allowance,
    created_at: stamp(row.created_at),
  };
}

export function legalEntityRow(row: LegalEntity): LegalEntityRow {
  return {
    id: id(row.id),
    organization_id: id(row.organization_id),
    name: row.name,
    tin: row.tin,
    vat_number: row.vat_number,
    created_at: stamp(row.created_at),
  };
}

export function branchRow(row: Branch): BranchRow {
  return {
    id: id(row.id),
    legal_entity_id: id(row.legal_entity_id),
    code: row.code,
    name: row.name,
    created_at: stamp(row.created_at),
  };
}

export function membershipRow(row: Membership): MembershipRow {
  return {
    id: id(row.id),
    user_id: row.user_id,
    organization_id: id(row.organization_id),
    role: row.role,
    created_at: stamp(row.created_at),
  };
}

export function fieldMappingRow(row: FieldMapping): FieldMappingRow {
  return {
    id: id(row.id),
    legal_entity_id: id(row.legal_entity_id),
    source_column: row.source_column,
    target_field: row.target_field,
  };
}

export function ramisCredentialRow(row: RamisCredential): RamisCredentialRow {
  return {
    legal_entity_id: id(row.legal_entity_id),
    certificate_secret_arn: row.certificate_secret_arn,
    updated_at: stamp(row.updated_at),
  };
}

export function serialCounterRow(row: SerialCounter): SerialCounterRow {
  return {
    branch_id: id(row.branch_id),
    legal_entity_id: id(row.legal_entity_id),
    period: row.period,
    last_value: row.last_value,
  };
}

export function outboundInvoiceRow(row: OutboundInvoice): OutboundInvoiceRow {
  return {
    id: id(row.id),
    organization_id: id(row.organization_id),
    legal_entity_id: id(row.legal_entity_id),
    branch_id: id(row.branch_id),
    serial_number: row.serial_number,
    erp_reference: row.erp_reference,
    invoice_type: row.invoice_type,
    invoice_date: day(row.invoice_date),
    supply_date: day(row.supply_date),
    customer_tin: row.customer_tin,
    customer_name: row.customer_name,
    customer_address: row.customer_address,
    place_of_supply: row.place_of_supply,
    currency: row.currency,
    exchange_rate: money(row.exchange_rate, 4),
    amount_exclusive_vat: money(row.amount_exclusive_vat),
    vat_rate: money(row.vat_rate),
    vat_amount: money(row.vat_amount),
    total_amount: money(row.total_amount),
    ramis_status: row.ramis_status,
    ramis_clearance_token: row.ramis_clearance_token,
    ramis_payload_hash: row.ramis_payload_hash,
    error_message: row.error_message,
    created_at: stamp(row.created_at),
    cleared_at: row.cleared_at ? stamp(row.cleared_at) : null,
  };
}

export function outboundAdjustmentRow(row: OutboundAdjustment): OutboundAdjustmentRow {
  return {
    id: id(row.id),
    organization_id: id(row.organization_id),
    legal_entity_id: id(row.legal_entity_id),
    branch_id: id(row.branch_id),
    serial_number: row.serial_number,
    adjustment_type: row.adjustment_type,
    erp_reference: row.erp_reference,
    original_invoice_id: id(row.original_invoice_id),
    original_serial_number: row.original_serial_number,
    original_invoice_date: day(row.original_invoice_date),
    reason: row.reason,
    adjustment_date: day(row.adjustment_date),
    adjusted_amount_exclusive_vat: money(row.adjusted_amount_exclusive_vat),
    adjusted_vat_amount: money(row.adjusted_vat_amount),
    adjusted_total_amount: money(row.adjusted_total_amount),
    ramis_status: row.ramis_status,
    ramis_clearance_token: row.ramis_clearance_token,
    ramis_payload_hash: row.ramis_payload_hash,
    error_message: row.error_message,
    created_at: stamp(row.created_at),
    cleared_at: row.cleared_at ? stamp(row.cleared_at) : null,
  };
}

export function invoiceUsageRow(row: InvoiceUsage): InvoiceUsageRow {
  return {
    organization_id: id(row.organization_id),
    period: day(row.period),
    cleared_count: row.cleared_count,
  };
}

export function inboundInvoiceRow(row: InboundInvoice): InboundInvoiceRow {
  return {
    id: id(row.id),
    organization_id: id(row.organization_id),
    legal_entity_id: id(row.legal_entity_id),
    supplier_tin: row.supplier_tin,
    supplier_name: row.supplier_name,
    supplier_invoice_number: row.supplier_invoice_number,
    invoice_date: day(row.invoice_date),
    amount_exclusive_vat: money(row.amount_exclusive_vat),
    vat_amount: money(row.vat_amount),
    total_amount: money(row.total_amount),
    erp_voucher_reference: row.erp_voucher_reference,
    matching_status: row.matching_status,
    is_approved_for_input_vat: row.is_approved_for_input_vat,
    approved_at: row.approved_at ? stamp(row.approved_at) : null,
    approved_by: row.approved_by,
    pulled_at: stamp(row.pulled_at),
  };
}

export function inboundAdjustmentRow(row: InboundAdjustment): InboundAdjustmentRow {
  return {
    id: id(row.id),
    organization_id: id(row.organization_id),
    legal_entity_id: id(row.legal_entity_id),
    supplier_tin: row.supplier_tin,
    supplier_name: row.supplier_name,
    adjustment_serial_number: row.adjustment_serial_number,
    adjustment_type: row.adjustment_type,
    original_invoice_number: row.original_invoice_number,
    adjustment_date: day(row.adjustment_date),
    adjusted_amount_exclusive_vat: money(row.adjusted_amount_exclusive_vat),
    adjusted_vat_amount: money(row.adjusted_vat_amount),
    matching_status: row.matching_status,
    is_approved: row.is_approved,
    approved_at: row.approved_at ? stamp(row.approved_at) : null,
    approved_by: row.approved_by,
    pulled_at: stamp(row.pulled_at),
  };
}

export function auditLogRow(row: AuditLog): AuditLogRow {
  return {
    id: id(row.id),
    organization_id: id(row.organization_id),
    legal_entity_id: row.legal_entity_id === null ? null : id(row.legal_entity_id),
    outbound_invoice_id: row.outbound_invoice_id === null ? null : id(row.outbound_invoice_id),
    outbound_adjustment_id: row.outbound_adjustment_id === null ? null : id(row.outbound_adjustment_id),
    inbound_invoice_id: row.inbound_invoice_id === null ? null : id(row.inbound_invoice_id),
    inbound_adjustment_id: row.inbound_adjustment_id === null ? null : id(row.inbound_adjustment_id),
    event: row.event,
    detail: row.detail as Record<string, unknown>,
    created_at: stamp(row.created_at),
  };
}
