create table demo_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text not null,
  company text not null,
  erp text not null,
  note text,
  created_at timestamptz not null default now(),
  constraint demo_requests_name_length check (char_length(name) between 1 and 120),
  constraint demo_requests_email_format check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  constraint demo_requests_phone_length check (char_length(phone) between 7 and 40),
  constraint demo_requests_company_length check (char_length(company) between 1 and 160),
  constraint demo_requests_erp_length check (char_length(erp) between 1 and 160),
  constraint demo_requests_note_length check (note is null or char_length(note) <= 2000)
);

create index demo_requests_created_at_idx on demo_requests (created_at desc);

alter table demo_requests enable row level security;

revoke all on table demo_requests from anon, authenticated;
