import type { AdjustmentResponse, ClearanceResponse } from "./ledger";

export type InvoiceRecord = {
  serialNumber: string;
  hash: string;
  supplierTin: string;
  supplierName: string;
  purchaserTin: string;
  purchaserName: string;
  invoiceDate: string;
  supplyDate: string;
  netCents: number;
  vatCents: number;
  totalCents: number;
  vatRateBasisPoints: number;
  recordId: string;
  approvalStatus: "PENDING_REVIEW" | "MATCHED";
  remainingVatCents: number;
  clearedAt: string;
  response: ClearanceResponse;
};

export type AdjustmentRecord = {
  serialNumber: string;
  hash: string;
  response: AdjustmentResponse;
};

export type IdempotencyHit = {
  hash: string;
  response: ClearanceResponse | AdjustmentResponse;
};

export type StoreTx = {
  lock(name: string): Promise<void>;
  invoiceCount(): Promise<number>;
  adjustmentCount(): Promise<number>;
  reset(): Promise<void>;
  idempotency(bucket: string, tin: string, key: string): Promise<IdempotencyHit | undefined>;
  remember(
    bucket: string,
    tin: string,
    key: string,
    hash: string,
    response: ClearanceResponse | AdjustmentResponse,
  ): Promise<void>;
  invoice(serialNumber: string): Promise<InvoiceRecord | undefined>;
  invoiceByRecord(recordId: string): Promise<InvoiceRecord | undefined>;
  insertInvoice(record: InvoiceRecord): Promise<void>;
  saveInvoice(record: InvoiceRecord): Promise<void>;
  adjustment(serialNumber: string): Promise<AdjustmentRecord | undefined>;
  insertAdjustment(record: AdjustmentRecord): Promise<void>;
  purchases(
    buyerTin: string,
    taxPeriod: string,
    approvalStatus: "PENDING_REVIEW" | "MATCHED" | undefined,
    page: number,
    pageSize: number,
  ): Promise<{ total: number; records: InvoiceRecord[] }>;
  allocateRecordId(): Promise<number>;
  allocateBatchId(): Promise<number>;
  hasInvoice(serialNumber: string): Promise<boolean>;
  hasAdjustment(serialNumber: string): Promise<boolean>;
};

export type Store = {
  transaction<T>(fn: (tx: StoreTx) => Promise<T>): Promise<T>;
};

export class MemoryStore implements Store {
  private readonly invoices = new Map<string, InvoiceRecord>();
  private readonly adjustments = new Map<string, AdjustmentRecord>();
  private readonly records = new Map<string, InvoiceRecord>();
  private readonly keys = new Map<string, IdempotencyHit>();
  private nextRecord = 8_849_201;
  private nextBatch = 88_310;

  transaction<T>(fn: (tx: StoreTx) => Promise<T>): Promise<T> {
    return fn(this);
  }

  lock(): Promise<void> {
    return Promise.resolve();
  }

  invoiceCount(): Promise<number> {
    return Promise.resolve(this.invoices.size);
  }

  adjustmentCount(): Promise<number> {
    return Promise.resolve(this.adjustments.size);
  }

  reset(): Promise<void> {
    this.invoices.clear();
    this.adjustments.clear();
    this.records.clear();
    this.keys.clear();
    this.nextRecord = 8_849_201;
    this.nextBatch = 88_310;
    return Promise.resolve();
  }

  idempotency(bucket: string, tin: string, key: string): Promise<IdempotencyHit | undefined> {
    return Promise.resolve(this.keys.get(`${bucket}:${tin}:${key}`));
  }

  remember(
    bucket: string,
    tin: string,
    key: string,
    hash: string,
    response: ClearanceResponse | AdjustmentResponse,
  ): Promise<void> {
    this.keys.set(`${bucket}:${tin}:${key}`, { hash, response });
    return Promise.resolve();
  }

  invoice(serialNumber: string): Promise<InvoiceRecord | undefined> {
    return Promise.resolve(this.invoices.get(serialNumber));
  }

  invoiceByRecord(recordId: string): Promise<InvoiceRecord | undefined> {
    return Promise.resolve(this.records.get(recordId));
  }

  insertInvoice(record: InvoiceRecord): Promise<void> {
    this.invoices.set(record.serialNumber, record);
    this.records.set(record.recordId, record);
    return Promise.resolve();
  }

  saveInvoice(record: InvoiceRecord): Promise<void> {
    this.invoices.set(record.serialNumber, record);
    this.records.set(record.recordId, record);
    return Promise.resolve();
  }

  adjustment(serialNumber: string): Promise<AdjustmentRecord | undefined> {
    return Promise.resolve(this.adjustments.get(serialNumber));
  }

  insertAdjustment(record: AdjustmentRecord): Promise<void> {
    this.adjustments.set(record.serialNumber, record);
    return Promise.resolve();
  }

  purchases(
    buyerTin: string,
    taxPeriod: string,
    approvalStatus: "PENDING_REVIEW" | "MATCHED" | undefined,
    page: number,
    pageSize: number,
  ): Promise<{ total: number; records: InvoiceRecord[] }> {
    const matched = [...this.invoices.values()]
      .filter((invoice) => invoice.purchaserTin === buyerTin && invoice.invoiceDate.slice(0, 7) === taxPeriod)
      .filter((invoice) => (approvalStatus ? invoice.approvalStatus === approvalStatus : true))
      .sort((left, right) => left.clearedAt.localeCompare(right.clearedAt) || left.recordId.localeCompare(right.recordId));
    const start = (page - 1) * pageSize;
    return Promise.resolve({ total: matched.length, records: matched.slice(start, start + pageSize) });
  }

  allocateRecordId(): Promise<number> {
    return Promise.resolve(this.nextRecord++);
  }

  allocateBatchId(): Promise<number> {
    return Promise.resolve(this.nextBatch++);
  }

  hasInvoice(serialNumber: string): Promise<boolean> {
    return Promise.resolve(this.invoices.has(serialNumber));
  }

  hasAdjustment(serialNumber: string): Promise<boolean> {
    return Promise.resolve(this.adjustments.has(serialNumber));
  }
}
