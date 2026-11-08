alter table erp_connections add column organization_id bigint;

update erp_connections c
set organization_id = e.organization_id
from legal_entities e
where e.id = c.legal_entity_id;

alter table erp_connections alter column organization_id set not null;
alter table erp_connections
  add constraint erp_connections_organization_id_fkey
  foreign key (organization_id) references organizations (id) on delete cascade;

alter table erp_connections drop constraint erp_connections_legal_entity_id_fkey;
alter table erp_connections alter column legal_entity_id drop not null;
alter table erp_connections
  add constraint erp_connections_legal_entity_id_fkey
  foreign key (legal_entity_id) references legal_entities (id) on delete set null;

alter table erp_connections drop constraint erp_connections_entity_erp_mode;

delete from erp_connections c
using erp_connections keep
where c.ingestion_mode = 'sftp'
  and keep.ingestion_mode = 'sftp'
  and c.organization_id = keep.organization_id
  and c.id > keep.id;

create unique index erp_connections_org_sftp_uidx
  on erp_connections (organization_id)
  where ingestion_mode = 'sftp';

create index erp_connections_org_mode_idx
  on erp_connections (organization_id, ingestion_mode);

alter table erp_connections
  add column label text,
  add column api_username text,
  add column api_secret text;

alter table erp_connections alter column status set default 'offline';

create table erp_change_requests (
  id bigint generated always as identity (start with 101) primary key,
  erp_connection_id bigint not null references erp_connections (id) on delete cascade,
  organization_id bigint not null references organizations (id) on delete cascade,
  user_id uuid not null,
  action text not null check (action in ('enable', 'disable')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create unique index erp_change_requests_pending_uidx
  on erp_change_requests (erp_connection_id)
  where status = 'pending';

create index erp_change_requests_org_idx
  on erp_change_requests (organization_id, status);

alter table erp_change_requests enable row level security;
revoke all on table erp_change_requests from anon, authenticated;
