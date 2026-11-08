alter table legal_entities
  add column ramis_enabled boolean not null default true;

update erp_connections
set legal_entity_id = null
where legal_entity_id is not null;
