create table admin_users (
  id bigint generated always as identity (start with 101) primary key,
  email text not null,
  password_hash text not null,
  created_at timestamptz not null default now(),
  constraint admin_users_email_uidx unique (email),
  constraint admin_users_email_format check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  constraint admin_users_hash_format check (password_hash ~ '^[0-9a-f]{32}:[0-9a-f]{64}$')
);

alter table admin_users enable row level security;

revoke all on table admin_users from anon, authenticated;
