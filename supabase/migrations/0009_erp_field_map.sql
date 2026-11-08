create table erp_field_maps (
  erp_code text not null,
  schedule text not null,
  mapping jsonb not null,
  primary key (erp_code, schedule),
  constraint erp_field_maps_schedule check (schedule in ('01', '04', '07')),
  constraint erp_field_maps_code check (
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
  constraint erp_field_maps_mapping_object check (jsonb_typeof(mapping) = 'object')
);

insert into erp_field_maps (erp_code, schedule, mapping)
select erp_code, schedule, jsonb_object_agg(erp_field, ramis_field order by ramis_field)
from erp_field_mappings
group by erp_code, schedule;

drop table erp_field_mappings;

alter table erp_field_maps rename to erp_field_mappings;
alter table erp_field_mappings rename constraint erp_field_maps_pkey to erp_field_mappings_pkey;
alter table erp_field_mappings rename constraint erp_field_maps_schedule to erp_field_mappings_schedule;
alter table erp_field_mappings rename constraint erp_field_maps_code to erp_field_mappings_code;
alter table erp_field_mappings rename constraint erp_field_maps_mapping_object to erp_field_mappings_mapping_object;

alter table erp_field_mappings enable row level security;
revoke all on table erp_field_mappings from anon, authenticated;

drop table field_mappings;
