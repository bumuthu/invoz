alter table ramis_invoices drop column if exists record_id;
alter table ramis_invoices drop column if exists approval_status;
drop table if exists ramis_counters;
