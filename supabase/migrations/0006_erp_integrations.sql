alter table erp_connections
  add column id bigint generated always as identity (start with 101);

alter table erp_connections drop constraint erp_connections_pkey;
alter table erp_connections add primary key (id);
alter table erp_connections
  add constraint erp_connections_entity_erp_mode unique (legal_entity_id, erp_code, ingestion_mode);

alter table erp_connections drop constraint erp_connections_status;
update erp_connections set status = 'live' where status = 'connected';
alter table erp_connections alter column status set default 'live';
alter table erp_connections
  add constraint erp_connections_status check (status in ('live', 'offline'));
