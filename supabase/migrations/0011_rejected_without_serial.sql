alter table outbound_invoices drop constraint outbound_invoices_tin;
alter table outbound_invoices add constraint outbound_invoices_tin check (
  customer_tin ~ '^[0-9]{9}$' or ramis_status = 'rejected'
);

alter table outbound_invoices drop constraint outbound_invoices_serial_when_submitted;
alter table outbound_invoices add constraint outbound_invoices_serial_when_submitted check (
  serial_number is not null or ramis_status not in ('cleared', 'validated')
);
