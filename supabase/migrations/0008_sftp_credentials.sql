create table sftp_credentials (
  organization_id bigint primary key references organizations (id) on delete cascade,
  password_hash text not null,
  updated_at timestamptz not null default now(),
  constraint sftp_credentials_hash_format check (password_hash ~ '^[0-9a-f]{32}:[0-9a-f]{64}$')
);

alter table sftp_credentials enable row level security;

revoke all on table sftp_credentials from anon, authenticated;
