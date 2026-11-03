create index outbound_invoices_entity_date_idx
  on outbound_invoices (legal_entity_id, invoice_date);

create index outbound_adjustments_entity_date_idx
  on outbound_adjustments (legal_entity_id, adjustment_date);

create index inbound_invoices_entity_date_idx
  on inbound_invoices (legal_entity_id, invoice_date);

create index inbound_invoices_entity_approval_idx
  on inbound_invoices (legal_entity_id, is_approved_for_input_vat);
