alter table organizations
  add column polling_enabled boolean not null default false;

alter table erp_connections
  add column ingestion_mode text not null default 'sftp',
  add column endpoint_url text,
  add column last_invoice_id text,
  add column last_polled_at timestamptz,
  add column next_poll_at timestamptz,
  add column last_error text,
  add column poll_locked_until timestamptz,
  add constraint erp_connections_ingestion_mode check (ingestion_mode in ('sftp', 'poll'));
