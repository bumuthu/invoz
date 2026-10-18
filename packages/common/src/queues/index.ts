import { isPayloadHash } from "../utils";

export const queueNames = {
  invoiceJobs: "invoicing-pipeline.fifo",
  invoiceJobsDlq: "invoicing-pipeline-dlq.fifo",
} as const;

export type QueueName = (typeof queueNames)[keyof typeof queueNames];

export const invoiceSources = ["s3", "webhook"] as const;
export type InvoiceSource = (typeof invoiceSources)[number];

export type InvoiceJob = {
  organizationId: string;
  legalEntityId: string;
  branchCode: string;
  source: InvoiceSource;
  objectKey?: string;
  payload?: unknown;
};

const sources = new Set<string>(invoiceSources);

export function invoiceMessageGroupId(legalEntityId: string, branchCode: string): string {
  return `${legalEntityId}:${branchCode}`;
}

export function invoiceMessageDeduplicationId(payloadSha256: string): string {
  if (!isPayloadHash(payloadSha256)) {
    throw new Error("MessageDeduplicationId must be a sha256 hex hash");
  }
  return payloadSha256;
}

export function parseInvoiceJob(body: string): InvoiceJob {
  const value: unknown = JSON.parse(body);
  if (typeof value !== "object" || value === null) {
    throw new Error("Queue body must be an object");
  }

  const job = value as Partial<InvoiceJob>;
  if (!job.organizationId || !job.legalEntityId || !job.branchCode) {
    throw new Error("organizationId, legalEntityId, and branchCode are required");
  }
  if (!job.source || !sources.has(job.source)) {
    throw new Error("source must be s3 or webhook");
  }
  if (job.source === "s3" && !job.objectKey) {
    throw new Error("s3 jobs require objectKey");
  }
  if (job.source === "webhook" && job.payload === undefined) {
    throw new Error("webhook jobs require payload");
  }

  return {
    organizationId: job.organizationId,
    legalEntityId: job.legalEntityId,
    branchCode: job.branchCode,
    source: job.source,
    objectKey: job.objectKey,
    payload: job.payload,
  };
}
