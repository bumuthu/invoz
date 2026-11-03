alter table outbound_adjustments
  add column customer_tin text,
  add column customer_name text,
  add constraint outbound_adjustments_customer_tin_format check (customer_tin is null or customer_tin ~ '^[0-9]{9}$');

create table erp_connections (
  legal_entity_id bigint primary key references legal_entities (id) on delete cascade,
  erp_code text not null,
  status text not null default 'connected',
  connected_at timestamptz not null default now(),
  constraint erp_connections_status check (status = 'connected'),
  constraint erp_connections_code check (
    erp_code in (
      's4hana',
      'sap_ecc',
      'sap_b1',
      'ifs',
      'dynamics',
      'business_central',
      'oracle',
      'netsuite',
      'odoo',
      'nav'
    )
  )
);

create table erp_field_mappings (
  id bigint generated always as identity (start with 101) primary key,
  erp_code text not null,
  schedule text not null,
  ramis_field text not null,
  erp_field text not null,
  constraint erp_field_mappings_schedule check (schedule in ('01', '04', '07')),
  constraint erp_field_mappings_code check (
    erp_code in (
      's4hana',
      'sap_ecc',
      'sap_b1',
      'ifs',
      'dynamics',
      'business_central',
      'oracle',
      'netsuite',
      'odoo',
      'nav'
    )
  ),
  unique (erp_code, schedule, ramis_field)
);

insert into erp_field_mappings (erp_code, schedule, ramis_field, erp_field)
select erp.code, schedule.code, field.path, field.path
from (
  values
    ('s4hana'),
    ('sap_ecc'),
    ('sap_b1'),
    ('ifs'),
    ('dynamics'),
    ('business_central'),
    ('oracle'),
    ('netsuite'),
    ('odoo'),
    ('nav')
) as erp(code)
cross join (values ('01'), ('07')) as schedule(code)
cross join (
  values
    ('header.serial_number'),
    ('header.erp_reference'),
    ('header.invoice_date'),
    ('header.supply_date'),
    ('header.invoice_type'),
    ('header.place_of_supply'),
    ('supplier.tin'),
    ('supplier.name'),
    ('supplier.address'),
    ('purchaser.tin'),
    ('purchaser.name'),
    ('purchaser.address'),
    ('currency_summary.currency'),
    ('currency_summary.exchange_rate'),
    ('currency_summary.total_value_excluding_vat'),
    ('currency_summary.vat_rate'),
    ('currency_summary.total_vat_amount'),
    ('currency_summary.total_consideration_including_vat'),
    ('line_items.item_sequence'),
    ('line_items.description'),
    ('line_items.quantity'),
    ('line_items.unit_of_measure'),
    ('line_items.unit_price'),
    ('line_items.line_amount_excluding_vat'),
    ('line_items.vat_rate'),
    ('line_items.vat_amount'),
    ('line_items.line_total_including_vat')
) as field(path);

insert into erp_field_mappings (erp_code, schedule, ramis_field, erp_field)
select erp.code, '04', field.path, field.path
from (
  values
    ('s4hana'),
    ('sap_ecc'),
    ('sap_b1'),
    ('ifs'),
    ('dynamics'),
    ('business_central'),
    ('oracle'),
    ('netsuite'),
    ('odoo'),
    ('nav')
) as erp(code)
cross join (
  values
    ('header.adjustment_serial_number'),
    ('header.adjustment_type'),
    ('header.adjustment_date'),
    ('header.original_invoice_serial_number'),
    ('header.original_invoice_date'),
    ('header.adjustment_reason'),
    ('supplier.tin'),
    ('supplier.name'),
    ('supplier.address'),
    ('purchaser.tin'),
    ('purchaser.name'),
    ('purchaser.address'),
    ('adjustment_values.adjusted_value_excluding_vat'),
    ('adjustment_values.vat_rate'),
    ('adjustment_values.adjusted_vat_amount'),
    ('adjustment_values.adjusted_total_consideration')
) as field(path);

alter table erp_connections enable row level security;
alter table erp_field_mappings enable row level security;

revoke all on table erp_connections, erp_field_mappings from anon, authenticated;
