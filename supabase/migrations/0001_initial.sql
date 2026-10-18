create extension if not exists pgcrypto;

create type portal_role as enum ('owner', 'admin', 'manager', 'staff', 'viewer');
create type invoice_class as enum ('standard', 'financial_services', 'zero_rated', 'exempt');
create type adjustment_type as enum ('credit_note', 'debit_note');
create type ramis_status as enum ('draft', 'validated', 'queued', 'cleared', 'rejected', 'skipped_non_vat');
create type matching_status as enum ('unmatched', 'matched', 'discrepancy');

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  monthly_allowance integer not null default 500,
  created_at timestamptz not null default now(),
  constraint organizations_slug_format check (slug ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'),
  constraint organizations_slug_reserved check (slug not in ('www', 'admin', 'app', 'api'))
);

create unique index organizations_slug_uidx on organizations (slug);

create table legal_entities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  tin text not null,
  vat_number text,
  created_at timestamptz not null default now(),
  constraint legal_entities_tin_format check (tin ~ '^[0-9]{9}$')
);

create unique index legal_entities_org_tin_uidx on legal_entities (organization_id, tin);

create table branches (
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references legal_entities (id) on delete cascade,
  code text not null,
  name text not null,
  created_at timestamptz not null default now(),
  constraint branches_code_format check (code ~ '^[A-Za-z0-9]{1,15}$')
);

create unique index branches_entity_code_uidx on branches (legal_entity_id, code);

create table memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  organization_id uuid not null references organizations (id) on delete cascade,
  role portal_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, organization_id)
);

create unique index memberships_one_owner_uidx
  on memberships (organization_id)
  where role = 'owner';

create table field_mappings (
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references legal_entities (id) on delete cascade,
  source_column text not null,
  target_field text not null,
  unique (legal_entity_id, source_column)
);

create table ramis_credentials (
  legal_entity_id uuid primary key references legal_entities (id) on delete cascade,
  certificate_secret_arn text not null,
  updated_at timestamptz not null default now()
);

create table serial_counters (
  branch_id uuid not null references branches (id) on delete cascade,
  legal_entity_id uuid not null references legal_entities (id) on delete cascade,
  period text not null,
  last_value integer not null,
  primary key (branch_id, period),
  constraint serial_counters_period_format check (period ~ '^[0-9]{2}[A-Z]{3}$'),
  constraint serial_counters_positive check (last_value > 0)
);

create table outbound_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  legal_entity_id uuid not null references legal_entities (id) on delete cascade,
  branch_id uuid not null references branches (id),
  serial_number text,
  erp_reference text not null,
  invoice_type invoice_class not null default 'standard',
  invoice_date date not null,
  supply_date date not null,
  customer_tin text not null,
  customer_name text not null,
  customer_address text,
  place_of_supply text,
  currency text not null default 'LKR',
  exchange_rate numeric(12, 4) not null default 1.0000,
  amount_exclusive_vat numeric(15, 2) not null,
  vat_rate numeric(5, 2) not null default 18.00,
  vat_amount numeric(15, 2) not null,
  total_amount numeric(15, 2) not null,
  ramis_status ramis_status not null default 'draft',
  ramis_clearance_token text,
  ramis_payload_hash text not null,
  error_message text,
  created_at timestamptz not null default now(),
  cleared_at timestamptz,
  constraint outbound_invoices_tin check (customer_tin ~ '^[0-9]{9}$'),
  constraint outbound_invoices_serial_length check (serial_number is null or char_length(serial_number) <= 40),
  constraint outbound_invoices_serial_when_submitted check (
    ramis_status = 'skipped_non_vat' or serial_number is not null
  ),
  constraint outbound_invoices_hash check (ramis_payload_hash ~ '^[a-f0-9]{64}$'),
  constraint outbound_invoices_amounts check (
    amount_exclusive_vat >= 0 and vat_amount >= 0 and total_amount >= 0 and exchange_rate > 0
  )
);

create unique index outbound_invoices_entity_serial_uidx
  on outbound_invoices (legal_entity_id, serial_number)
  where serial_number is not null;
create unique index outbound_invoices_entity_erp_uidx
  on outbound_invoices (legal_entity_id, erp_reference);
create unique index outbound_invoices_entity_hash_uidx
  on outbound_invoices (legal_entity_id, ramis_payload_hash);
create index outbound_invoices_entity_status_idx
  on outbound_invoices (legal_entity_id, ramis_status, created_at desc);

create table outbound_adjustments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  legal_entity_id uuid not null references legal_entities (id) on delete cascade,
  branch_id uuid not null references branches (id),
  serial_number text,
  adjustment_type adjustment_type not null,
  erp_reference text not null,
  original_invoice_id uuid not null references outbound_invoices (id),
  original_serial_number text not null,
  original_invoice_date date not null,
  reason text not null,
  adjustment_date date not null,
  adjusted_amount_exclusive_vat numeric(15, 2) not null,
  adjusted_vat_amount numeric(15, 2) not null,
  adjusted_total_amount numeric(15, 2) not null,
  ramis_status ramis_status not null default 'draft',
  ramis_clearance_token text,
  ramis_payload_hash text not null,
  error_message text,
  created_at timestamptz not null default now(),
  cleared_at timestamptz,
  constraint outbound_adjustments_serial_length check (serial_number is null or char_length(serial_number) <= 40),
  constraint outbound_adjustments_serial_when_submitted check (
    ramis_status = 'skipped_non_vat' or serial_number is not null
  ),
  constraint outbound_adjustments_hash check (ramis_payload_hash ~ '^[a-f0-9]{64}$'),
  constraint outbound_adjustments_amounts check (
    adjusted_amount_exclusive_vat >= 0
    and adjusted_vat_amount >= 0
    and adjusted_total_amount >= 0
  )
);

create unique index outbound_adjustments_entity_serial_uidx
  on outbound_adjustments (legal_entity_id, serial_number)
  where serial_number is not null;
create unique index outbound_adjustments_entity_erp_uidx
  on outbound_adjustments (legal_entity_id, erp_reference);
create unique index outbound_adjustments_entity_hash_uidx
  on outbound_adjustments (legal_entity_id, ramis_payload_hash);

create table invoice_usage (
  organization_id uuid not null references organizations (id) on delete cascade,
  period date not null,
  cleared_count integer not null default 0,
  primary key (organization_id, period),
  constraint invoice_usage_month check (period = date_trunc('month', period)::date),
  constraint invoice_usage_non_negative check (cleared_count >= 0)
);

create table inbound_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  legal_entity_id uuid not null references legal_entities (id) on delete cascade,
  supplier_tin text not null,
  supplier_name text not null,
  supplier_invoice_number text not null,
  invoice_date date not null,
  amount_exclusive_vat numeric(15, 2) not null,
  vat_amount numeric(15, 2) not null,
  total_amount numeric(15, 2) not null,
  erp_voucher_reference text,
  matching_status matching_status not null default 'unmatched',
  is_approved_for_input_vat boolean not null default false,
  approved_at timestamptz,
  approved_by uuid references auth.users (id),
  pulled_at timestamptz not null default now(),
  constraint inbound_invoices_tin check (supplier_tin ~ '^[0-9]{9}$'),
  constraint inbound_invoices_amounts check (
    amount_exclusive_vat >= 0 and vat_amount >= 0 and total_amount >= 0
  ),
  unique (legal_entity_id, supplier_tin, supplier_invoice_number)
);

create table inbound_adjustments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  legal_entity_id uuid not null references legal_entities (id) on delete cascade,
  supplier_tin text not null,
  supplier_name text not null,
  adjustment_serial_number text not null,
  adjustment_type adjustment_type not null,
  original_invoice_number text not null,
  adjustment_date date not null,
  adjusted_amount_exclusive_vat numeric(15, 2) not null,
  adjusted_vat_amount numeric(15, 2) not null,
  matching_status matching_status not null default 'unmatched',
  is_approved boolean not null default false,
  approved_at timestamptz,
  approved_by uuid references auth.users (id),
  pulled_at timestamptz not null default now(),
  constraint inbound_adjustments_tin check (supplier_tin ~ '^[0-9]{9}$'),
  constraint inbound_adjustments_amounts check (
    adjusted_amount_exclusive_vat >= 0 and adjusted_vat_amount >= 0
  ),
  unique (legal_entity_id, supplier_tin, adjustment_serial_number)
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  legal_entity_id uuid references legal_entities (id) on delete cascade,
  outbound_invoice_id uuid references outbound_invoices (id) on delete set null,
  outbound_adjustment_id uuid references outbound_adjustments (id) on delete set null,
  inbound_invoice_id uuid references inbound_invoices (id) on delete set null,
  inbound_adjustment_id uuid references inbound_adjustments (id) on delete set null,
  event text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_org_created_idx on audit_logs (organization_id, created_at desc);

create or replace function next_gazette_serial(p_branch_id uuid, p_on date default current_date)
returns text
language plpgsql
as $$
declare
  v_entity_id uuid;
  v_code text;
  v_period text;
  v_next integer;
  v_months text[] := array['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
begin
  select legal_entity_id, code into v_entity_id, v_code
  from branches
  where id = p_branch_id;

  if v_entity_id is null then
    raise exception 'branch % not found', p_branch_id;
  end if;

  v_period := to_char(p_on, 'YY') || v_months[extract(month from p_on)::integer];

  insert into serial_counters (branch_id, legal_entity_id, period, last_value)
  values (p_branch_id, v_entity_id, v_period, 1)
  on conflict (branch_id, period)
  do update set last_value = serial_counters.last_value + 1
  returning last_value into v_next;

  return v_period || '_' || v_code || '_' || lpad(v_next::text, 5, '0');
end;
$$;

create or replace function invoice_matches_organization()
returns trigger
language plpgsql
as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from legal_entities where id = new.legal_entity_id;
  if v_org is distinct from new.organization_id then
    raise exception 'invoice organization does not match the legal entity';
  end if;
  return new;
end;
$$;

create trigger outbound_invoices_match_organization
  before insert or update on outbound_invoices
  for each row execute function invoice_matches_organization();

create trigger outbound_adjustments_match_organization
  before insert or update on outbound_adjustments
  for each row execute function invoice_matches_organization();

create trigger inbound_invoices_match_organization
  before insert or update on inbound_invoices
  for each row execute function invoice_matches_organization();

create trigger inbound_adjustments_match_organization
  before insert or update on inbound_adjustments
  for each row execute function invoice_matches_organization();

alter table organizations enable row level security;
alter table legal_entities enable row level security;
alter table branches enable row level security;
alter table memberships enable row level security;
alter table field_mappings enable row level security;
alter table ramis_credentials enable row level security;
alter table serial_counters enable row level security;
alter table outbound_invoices enable row level security;
alter table outbound_adjustments enable row level security;
alter table invoice_usage enable row level security;
alter table inbound_invoices enable row level security;
alter table inbound_adjustments enable row level security;
alter table audit_logs enable row level security;

revoke all on table
  organizations,
  legal_entities,
  branches,
  memberships,
  field_mappings,
  ramis_credentials,
  serial_counters,
  outbound_invoices,
  outbound_adjustments,
  invoice_usage,
  inbound_invoices,
  inbound_adjustments,
  audit_logs
from anon, authenticated;

revoke all on function next_gazette_serial(uuid, date) from public, anon, authenticated;
grant execute on function next_gazette_serial(uuid, date) to service_role;
