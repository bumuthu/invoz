# Database entity diagram

This matches `supabase/migrations/0001_initial.sql`. A membership is one user on one organization. Legal entities and branches are business records, not permission boundaries.

`inbound_adjustments.original_invoice_number` stores the supplier's invoice number. It is not a foreign key.

```mermaid
erDiagram
  AUTH_USERS ||--o{ MEMBERSHIPS : "signs in as"
  AUTH_USERS |o--o{ INBOUND_INVOICES : "approves"
  AUTH_USERS |o--o{ INBOUND_ADJUSTMENTS : "approves"

  ORGANIZATIONS ||--o{ LEGAL_ENTITIES : "owns"
  ORGANIZATIONS ||--o{ MEMBERSHIPS : "includes"
  ORGANIZATIONS ||--o{ OUTBOUND_INVOICES : "sells"
  ORGANIZATIONS ||--o{ OUTBOUND_ADJUSTMENTS : "corrects"
  ORGANIZATIONS ||--o{ INBOUND_INVOICES : "buys"
  ORGANIZATIONS ||--o{ INBOUND_ADJUSTMENTS : "receives"
  ORGANIZATIONS ||--o{ INVOICE_USAGE : "counts"
  ORGANIZATIONS ||--o{ AUDIT_LOGS : "records"

  LEGAL_ENTITIES ||--o{ BRANCHES : "has"
  LEGAL_ENTITIES ||--o{ FIELD_MAPPINGS : "maps"
  LEGAL_ENTITIES ||--o| RAMIS_CREDENTIALS : "certifies"
  LEGAL_ENTITIES ||--o{ SERIAL_COUNTERS : "numbers"
  LEGAL_ENTITIES ||--o{ OUTBOUND_INVOICES : "issues"
  LEGAL_ENTITIES ||--o{ OUTBOUND_ADJUSTMENTS : "adjusts"
  LEGAL_ENTITIES ||--o{ INBOUND_INVOICES : "claims"
  LEGAL_ENTITIES ||--o{ INBOUND_ADJUSTMENTS : "reviews"
  LEGAL_ENTITIES |o--o{ AUDIT_LOGS : "traces"

  BRANCHES ||--o{ SERIAL_COUNTERS : "sequences"
  BRANCHES ||--o{ OUTBOUND_INVOICES : "lanes"
  BRANCHES ||--o{ OUTBOUND_ADJUSTMENTS : "lanes"

  OUTBOUND_INVOICES ||--o{ OUTBOUND_ADJUSTMENTS : "original of"
  OUTBOUND_INVOICES |o--o{ AUDIT_LOGS : "explains"
  OUTBOUND_ADJUSTMENTS |o--o{ AUDIT_LOGS : "explains"
  INBOUND_INVOICES |o--o{ AUDIT_LOGS : "explains"
  INBOUND_ADJUSTMENTS |o--o{ AUDIT_LOGS : "explains"

  ORGANIZATIONS {
    uuid id PK
    text slug UK
    int monthly_allowance
  }
  LEGAL_ENTITIES {
    uuid id PK
    uuid organization_id FK
    text tin
  }
  BRANCHES {
    uuid id PK
    uuid legal_entity_id FK
    text code
  }
  AUTH_USERS {
    uuid id PK
  }
  MEMBERSHIPS {
    uuid id PK
    uuid user_id FK
    uuid organization_id FK
    portal_role role
  }
  FIELD_MAPPINGS {
    uuid id PK
    uuid legal_entity_id FK
    text source_column
    text target_field
  }
  RAMIS_CREDENTIALS {
    uuid legal_entity_id PK
    text certificate_secret_arn
  }
  SERIAL_COUNTERS {
    uuid branch_id PK
    text period PK
    uuid legal_entity_id FK
    int last_value
  }
  OUTBOUND_INVOICES {
    uuid id PK
    uuid organization_id FK
    uuid legal_entity_id FK
    uuid branch_id FK
    text serial_number
    text erp_reference
    invoice_class invoice_type
    text customer_tin
    numeric total_amount
    ramis_status ramis_status
    text ramis_payload_hash
  }
  OUTBOUND_ADJUSTMENTS {
    uuid id PK
    uuid organization_id FK
    uuid legal_entity_id FK
    uuid branch_id FK
    uuid original_invoice_id FK
    adjustment_type adjustment_type
    text original_serial_number
    text reason
    ramis_status ramis_status
  }
  INBOUND_INVOICES {
    uuid id PK
    uuid organization_id FK
    uuid legal_entity_id FK
    text supplier_tin
    text supplier_invoice_number
    numeric vat_amount
    matching_status matching_status
    boolean is_approved_for_input_vat
    uuid approved_by FK
  }
  INBOUND_ADJUSTMENTS {
    uuid id PK
    uuid organization_id FK
    uuid legal_entity_id FK
    text supplier_tin
    text adjustment_serial_number
    text original_invoice_number
    adjustment_type adjustment_type
    matching_status matching_status
    uuid approved_by FK
  }
  INVOICE_USAGE {
    uuid organization_id PK
    date period PK
    int cleared_count
  }
  AUDIT_LOGS {
    uuid id PK
    uuid organization_id FK
    uuid legal_entity_id FK
    uuid outbound_invoice_id FK
    uuid outbound_adjustment_id FK
    uuid inbound_invoice_id FK
    uuid inbound_adjustment_id FK
    text event
  }
```
