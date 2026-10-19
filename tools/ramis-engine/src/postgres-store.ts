import type { AdjustmentResponse, ClearanceResponse } from "./ledger";
import type { Sql } from "./sql";
import type { AdjustmentRecord, IdempotencyHit, InvoiceRecord, Store, StoreTx } from "./store";

type InvoiceRow = {
  serial_number: string;
  payload_hash: string;
  supplier_tin: string;
  supplier_name: string;
  purchaser_tin: string;
  purchaser_name: string;
  invoice_date: string;
  supply_date: string;
  net_cents: string | number;
  vat_cents: string | number;
  total_cents: string | number;
  vat_rate_basis_points: string | number;
  record_id: string;
  approval_status: "PENDING_REVIEW" | "MATCHED";
  remaining_vat_cents: string | number;
  cleared_at: string;
  response: ClearanceResponse | string;
};

type AdjustmentRow = {
  serial_number: string;
  payload_hash: string;
  response: AdjustmentResponse | string;
};

type IdempotencyRow = {
  payload_hash: string;
  response: ClearanceResponse | AdjustmentResponse | string;
};

export class PostgresStore implements Store {
  constructor(private readonly sql: Sql) {}

  transaction<T>(fn: (tx: StoreTx) => Promise<T>): Promise<T> {
    return this.sql.transaction(async (sql) => fn(new PostgresTx(sql)));
  }
}

class PostgresTx implements StoreTx {
  constructor(private readonly sql: Sql) {}

  async lock(name: string): Promise<void> {
    await this.sql.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [name]);
  }

  async invoiceCount(): Promise<number> {
    const result = await this.sql.query<{ total: string | number }>("select count(*) as total from ramis_invoices");
    return Number(result.rows[0]?.total ?? 0);
  }

  async adjustmentCount(): Promise<number> {
    const result = await this.sql.query<{ total: string | number }>(
      "select count(*) as total from ramis_adjustments",
    );
    return Number(result.rows[0]?.total ?? 0);
  }

  async reset(): Promise<void> {
    await this.sql.query("truncate ramis_adjustments, ramis_invoices, ramis_idempotency");
    await this.sql.query("update ramis_counters set value = 8849201 where name = 'record'");
    await this.sql.query("update ramis_counters set value = 88310 where name = 'batch'");
  }

  async idempotency(bucket: string, tin: string, key: string): Promise<IdempotencyHit | undefined> {
    const result = await this.sql.query<IdempotencyRow>(
      `select payload_hash, response
       from ramis_idempotency
       where bucket = $1 and tin = $2 and idempotency_key = $3`,
      [bucket, tin, key],
    );
    const row = result.rows[0];
    if (!row) return undefined;
    return { hash: row.payload_hash, response: jsonValue(row.response) };
  }

  async remember(
    bucket: string,
    tin: string,
    key: string,
    hash: string,
    response: ClearanceResponse | AdjustmentResponse,
  ): Promise<void> {
    await this.sql.query(
      `insert into ramis_idempotency (bucket, tin, idempotency_key, payload_hash, response)
       values ($1, $2, $3, $4, cast($5 as jsonb))`,
      [bucket, tin, key, hash, JSON.stringify(response)],
    );
  }

  async invoice(serialNumber: string): Promise<InvoiceRecord | undefined> {
    const result = await this.sql.query<InvoiceRow>(
      "select * from ramis_invoices where serial_number = $1 for update",
      [serialNumber],
    );
    const row = result.rows[0];
    return row ? invoiceFromRow(row) : undefined;
  }

  async invoiceByRecord(recordId: string): Promise<InvoiceRecord | undefined> {
    const result = await this.sql.query<InvoiceRow>("select * from ramis_invoices where record_id = $1 for update", [
      recordId,
    ]);
    const row = result.rows[0];
    return row ? invoiceFromRow(row) : undefined;
  }

  async insertInvoice(record: InvoiceRecord): Promise<void> {
    await this.sql.query(
      `insert into ramis_invoices (
         serial_number, payload_hash, supplier_tin, supplier_name, purchaser_tin, purchaser_name,
         invoice_date, supply_date, net_cents, vat_cents, total_cents, vat_rate_basis_points,
         record_id, approval_status, remaining_vat_cents, cleared_at, response
       ) values (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10, $11, $12,
         $13, $14, $15, $16, cast($17 as jsonb)
       )`,
      [
        record.serialNumber,
        record.hash,
        record.supplierTin,
        record.supplierName,
        record.purchaserTin,
        record.purchaserName,
        record.invoiceDate,
        record.supplyDate,
        record.netCents,
        record.vatCents,
        record.totalCents,
        record.vatRateBasisPoints,
        record.recordId,
        record.approvalStatus,
        record.remainingVatCents,
        record.clearedAt,
        JSON.stringify(record.response),
      ],
    );
  }

  async saveInvoice(record: InvoiceRecord): Promise<void> {
    await this.sql.query(
      `update ramis_invoices
       set approval_status = $2, remaining_vat_cents = $3
       where serial_number = $1`,
      [record.serialNumber, record.approvalStatus, record.remainingVatCents],
    );
  }

  async adjustment(serialNumber: string): Promise<AdjustmentRecord | undefined> {
    const result = await this.sql.query<AdjustmentRow>(
      "select serial_number, payload_hash, response from ramis_adjustments where serial_number = $1",
      [serialNumber],
    );
    const row = result.rows[0];
    if (!row) return undefined;
    return {
      serialNumber: row.serial_number,
      hash: row.payload_hash,
      response: jsonValue(row.response),
    };
  }

  async insertAdjustment(record: AdjustmentRecord): Promise<void> {
    await this.sql.query(
      `insert into ramis_adjustments (serial_number, payload_hash, original_serial_number, response)
       values ($1, $2, $3, cast($4 as jsonb))`,
      [
        record.serialNumber,
        record.hash,
        record.response.original_invoice_serial_number,
        JSON.stringify(record.response),
      ],
    );
  }

  async purchases(
    buyerTin: string,
    taxPeriod: string,
    approvalStatus: "PENDING_REVIEW" | "MATCHED" | undefined,
    page: number,
    pageSize: number,
  ): Promise<{ total: number; records: InvoiceRecord[] }> {
    const filter = `purchaser_tin = $1 and substr(invoice_date, 1, 7) = $2 and ($3::text is null or approval_status = $3)`;
    const params = [buyerTin, taxPeriod, approvalStatus ?? null];
    const count = await this.sql.query<{ total: string | number }>(
      `select count(*) as total from ramis_invoices where ${filter}`,
      params,
    );
    const rows = await this.sql.query<InvoiceRow>(
      `select * from ramis_invoices
       where ${filter}
       order by cleared_at asc, record_id asc
       limit $4 offset $5`,
      [...params, pageSize, (page - 1) * pageSize],
    );
    return {
      total: Number(count.rows[0]?.total ?? 0),
      records: rows.rows.map(invoiceFromRow),
    };
  }

  async allocateRecordId(): Promise<number> {
    return allocate(this.sql, "record");
  }

  async allocateBatchId(): Promise<number> {
    return allocate(this.sql, "batch");
  }

  async hasInvoice(serialNumber: string): Promise<boolean> {
    const result = await this.sql.query("select 1 as found from ramis_invoices where serial_number = $1", [
      serialNumber,
    ]);
    return result.rows.length > 0;
  }

  async hasAdjustment(serialNumber: string): Promise<boolean> {
    const result = await this.sql.query("select 1 as found from ramis_adjustments where serial_number = $1", [
      serialNumber,
    ]);
    return result.rows.length > 0;
  }
}

async function allocate(sql: Sql, name: string): Promise<number> {
  const result = await sql.query<{ value: string | number }>(
    "update ramis_counters set value = value + 1 where name = $1 returning value",
    [name],
  );
  const value = result.rows[0]?.value;
  if (value === undefined) {
    throw new Error(`ramis counter ${name} is missing`);
  }
  return Number(value) - 1;
}

function invoiceFromRow(row: InvoiceRow): InvoiceRecord {
  return {
    serialNumber: row.serial_number,
    hash: row.payload_hash,
    supplierTin: row.supplier_tin,
    supplierName: row.supplier_name,
    purchaserTin: row.purchaser_tin,
    purchaserName: row.purchaser_name,
    invoiceDate: row.invoice_date,
    supplyDate: row.supply_date,
    netCents: Number(row.net_cents),
    vatCents: Number(row.vat_cents),
    totalCents: Number(row.total_cents),
    vatRateBasisPoints: Number(row.vat_rate_basis_points),
    recordId: row.record_id,
    approvalStatus: row.approval_status,
    remainingVatCents: Number(row.remaining_vat_cents),
    clearedAt: row.cleared_at,
    response: jsonValue(row.response),
  };
}

function jsonValue<T>(value: T | string): T {
  return typeof value === "string" ? (JSON.parse(value) as T) : value;
}
