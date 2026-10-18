import type {
  AdjustmentType,
  InvoiceClass,
  MatchingStatus,
  PortalRole,
  RamisStatus,
} from "../entities";

export type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  monthly_allowance: number;
  created_at: string;
};

export type LegalEntityRow = {
  id: string;
  organization_id: string;
  name: string;
  tin: string;
  vat_number: string | null;
  created_at: string;
};

export type BranchRow = {
  id: string;
  legal_entity_id: string;
  code: string;
  name: string;
  created_at: string;
};

export type MembershipRow = {
  id: string;
  user_id: string;
  organization_id: string;
  role: PortalRole;
  created_at: string;
};

export type FieldMappingRow = {
  id: string;
  legal_entity_id: string;
  source_column: string;
  target_field: string;
};

export type RamisCredentialRow = {
  legal_entity_id: string;
  certificate_secret_arn: string;
  updated_at: string;
};

export type SerialCounterRow = {
  branch_id: string;
  legal_entity_id: string;
  period: string;
  last_value: number;
};

export type OutboundInvoiceRow = {
  id: string;
  organization_id: string;
  legal_entity_id: string;
  branch_id: string;
  serial_number: string | null;
  erp_reference: string;
  invoice_type: InvoiceClass;
  invoice_date: string;
  supply_date: string;
  customer_tin: string;
  customer_name: string;
  customer_address: string | null;
  place_of_supply: string | null;
  currency: string;
  exchange_rate: string;
  amount_exclusive_vat: string;
  vat_rate: string;
  vat_amount: string;
  total_amount: string;
  ramis_status: RamisStatus;
  ramis_clearance_token: string | null;
  ramis_payload_hash: string;
  error_message: string | null;
  created_at: string;
  cleared_at: string | null;
};

export type OutboundAdjustmentRow = {
  id: string;
  organization_id: string;
  legal_entity_id: string;
  branch_id: string;
  serial_number: string | null;
  adjustment_type: AdjustmentType;
  erp_reference: string;
  original_invoice_id: string;
  original_serial_number: string;
  original_invoice_date: string;
  reason: string;
  adjustment_date: string;
  adjusted_amount_exclusive_vat: string;
  adjusted_vat_amount: string;
  adjusted_total_amount: string;
  ramis_status: RamisStatus;
  ramis_clearance_token: string | null;
  ramis_payload_hash: string;
  error_message: string | null;
  created_at: string;
  cleared_at: string | null;
};

export type InboundInvoiceRow = {
  id: string;
  organization_id: string;
  legal_entity_id: string;
  supplier_tin: string;
  supplier_name: string;
  supplier_invoice_number: string;
  invoice_date: string;
  amount_exclusive_vat: string;
  vat_amount: string;
  total_amount: string;
  erp_voucher_reference: string | null;
  matching_status: MatchingStatus;
  is_approved_for_input_vat: boolean;
  approved_at: string | null;
  approved_by: string | null;
  pulled_at: string;
};

export type InboundAdjustmentRow = {
  id: string;
  organization_id: string;
  legal_entity_id: string;
  supplier_tin: string;
  supplier_name: string;
  adjustment_serial_number: string;
  adjustment_type: AdjustmentType;
  original_invoice_number: string;
  adjustment_date: string;
  adjusted_amount_exclusive_vat: string;
  adjusted_vat_amount: string;
  matching_status: MatchingStatus;
  is_approved: boolean;
  approved_at: string | null;
  approved_by: string | null;
  pulled_at: string;
};

export type InvoiceUsageRow = {
  organization_id: string;
  period: string;
  cleared_count: number;
};

export type AuditLogRow = {
  id: string;
  organization_id: string;
  legal_entity_id: string | null;
  outbound_invoice_id: string | null;
  outbound_adjustment_id: string | null;
  inbound_invoice_id: string | null;
  inbound_adjustment_id: string | null;
  event: string;
  detail: Record<string, unknown>;
  created_at: string;
};

export type Tables = {
  organizations: OrganizationRow;
  legal_entities: LegalEntityRow;
  branches: BranchRow;
  memberships: MembershipRow;
  field_mappings: FieldMappingRow;
  ramis_credentials: RamisCredentialRow;
  serial_counters: SerialCounterRow;
  outbound_invoices: OutboundInvoiceRow;
  outbound_adjustments: OutboundAdjustmentRow;
  invoice_usage: InvoiceUsageRow;
  inbound_invoices: InboundInvoiceRow;
  inbound_adjustments: InboundAdjustmentRow;
  audit_logs: AuditLogRow;
};

export type TableName = keyof Tables;

export const tableColumns = {
  organizations: ["id", "name", "slug", "monthly_allowance", "created_at"],
  legal_entities: ["id", "organization_id", "name", "tin", "vat_number", "created_at"],
  branches: ["id", "legal_entity_id", "code", "name", "created_at"],
  memberships: ["id", "user_id", "organization_id", "role", "created_at"],
  field_mappings: ["id", "legal_entity_id", "source_column", "target_field"],
  ramis_credentials: ["legal_entity_id", "certificate_secret_arn", "updated_at"],
  serial_counters: ["branch_id", "legal_entity_id", "period", "last_value"],
  outbound_invoices: [
    "id",
    "organization_id",
    "legal_entity_id",
    "branch_id",
    "serial_number",
    "erp_reference",
    "invoice_type",
    "invoice_date",
    "supply_date",
    "customer_tin",
    "customer_name",
    "customer_address",
    "place_of_supply",
    "currency",
    "exchange_rate",
    "amount_exclusive_vat",
    "vat_rate",
    "vat_amount",
    "total_amount",
    "ramis_status",
    "ramis_clearance_token",
    "ramis_payload_hash",
    "error_message",
    "created_at",
    "cleared_at",
  ],
  outbound_adjustments: [
    "id",
    "organization_id",
    "legal_entity_id",
    "branch_id",
    "serial_number",
    "adjustment_type",
    "erp_reference",
    "original_invoice_id",
    "original_serial_number",
    "original_invoice_date",
    "reason",
    "adjustment_date",
    "adjusted_amount_exclusive_vat",
    "adjusted_vat_amount",
    "adjusted_total_amount",
    "ramis_status",
    "ramis_clearance_token",
    "ramis_payload_hash",
    "error_message",
    "created_at",
    "cleared_at",
  ],
  invoice_usage: ["organization_id", "period", "cleared_count"],
  inbound_invoices: [
    "id",
    "organization_id",
    "legal_entity_id",
    "supplier_tin",
    "supplier_name",
    "supplier_invoice_number",
    "invoice_date",
    "amount_exclusive_vat",
    "vat_amount",
    "total_amount",
    "erp_voucher_reference",
    "matching_status",
    "is_approved_for_input_vat",
    "approved_at",
    "approved_by",
    "pulled_at",
  ],
  inbound_adjustments: [
    "id",
    "organization_id",
    "legal_entity_id",
    "supplier_tin",
    "supplier_name",
    "adjustment_serial_number",
    "adjustment_type",
    "original_invoice_number",
    "adjustment_date",
    "adjusted_amount_exclusive_vat",
    "adjusted_vat_amount",
    "matching_status",
    "is_approved",
    "approved_at",
    "approved_by",
    "pulled_at",
  ],
  audit_logs: [
    "id",
    "organization_id",
    "legal_entity_id",
    "outbound_invoice_id",
    "outbound_adjustment_id",
    "inbound_invoice_id",
    "inbound_adjustment_id",
    "event",
    "detail",
    "created_at",
  ],
} as const satisfies { [K in TableName]: readonly (keyof Tables[K])[] };
