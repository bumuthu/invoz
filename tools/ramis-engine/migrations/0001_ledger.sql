create table if not exists ramis_invoices (
  serial_number text primary key,
  payload_hash text not null,
  supplier_tin text not null,
  supplier_name text not null,
  purchaser_tin text not null,
  purchaser_name text not null,
  invoice_date text not null,
  supply_date text not null,
  net_cents bigint not null,
  vat_cents bigint not null,
  total_cents bigint not null,
  vat_rate_basis_points integer not null,
  record_id text not null unique,
  approval_status text not null,
  remaining_vat_cents bigint not null,
  cleared_at text not null,
  response jsonb not null
);

create table if not exists ramis_adjustments (
  serial_number text primary key,
  payload_hash text not null,
  original_serial_number text not null references ramis_invoices (serial_number),
  response jsonb not null
);

create table if not exists ramis_idempotency (
  bucket text not null,
  tin text not null,
  idempotency_key text not null,
  payload_hash text not null,
  response jsonb not null,
  primary key (bucket, tin, idempotency_key)
);

create table if not exists ramis_counters (
  name text primary key,
  value bigint not null
);

insert into ramis_counters (name, value) values
  ('record', 8849201),
  ('batch', 88310)
on conflict (name) do nothing;
