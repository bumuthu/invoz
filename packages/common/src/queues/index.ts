import { isPayloadHash } from "../utils";

export const deployEnvironments = ["stag", "prod"] as const;
export type DeployEnvironment = (typeof deployEnvironments)[number];

export function queueNames(env: DeployEnvironment) {
  return {
    invoiceJobs: `invoz-${env}-invoicing-pipeline.fifo`,
    invoiceJobsDlq: `invoz-${env}-invoicing-pipeline-dlq.fifo`,
  } as const;
}

export type QueueName = ReturnType<typeof queueNames>[keyof ReturnType<typeof queueNames>];

export const invoiceSources = ["s3", "webhook"] as const;
export type InvoiceSource = (typeof invoiceSources)[number];

export type InvoiceJob = {
  organizationId: string;
  legalEntityId: string;
  branchCode?: string;
  source: InvoiceSource;
  bucket?: string;
  objectKey?: string;
  payload?: unknown;
};

const inboundKeyPattern = /^uploads\/([^/]+)\/([^/]+)\/inbound\/[^/]+\.csv$/;

export function invoiceIdsFromObjectKey(objectKey: string): {
  organizationId: string;
  legalEntityId: string;
  objectKey: string;
} {
  const key = decodeObjectKey(objectKey);
  const match = inboundKeyPattern.exec(key);
  if (!match) {
    throw new Error("objectKey must be uploads/{organizationId}/{legalEntityId}/inbound/{file}.csv");
  }
  return { organizationId: match[1], legalEntityId: match[2], objectKey: key };
}

function decodeObjectKey(objectKey: string): string {
  const key = objectKey.replace(/^\//, "");
  if (!key.includes("%")) {
    return key;
  }
  try {
    return decodeURIComponent(key);
  } catch {
    return key;
  }
}

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

  const job = value as {
    organizationId?: unknown;
    legalEntityId?: unknown;
    branchCode?: unknown;
    source?: unknown;
    bucket?: unknown;
    objectKey?: unknown;
    payload?: unknown;
  };
  if (typeof job.source !== "string" || !sources.has(job.source)) {
    throw new Error("source must be s3 or webhook");
  }
  const source = job.source as InvoiceSource;

  if (source === "s3") {
    if (typeof job.objectKey !== "string" || job.objectKey === "") {
      throw new Error("s3 jobs require objectKey");
    }
    const fromKey = invoiceIdsFromObjectKey(job.objectKey);
    const organizationId = text(job.organizationId);
    const legalEntityId = text(job.legalEntityId);
    if (organizationId && organizationId !== fromKey.organizationId) {
      throw new Error("organizationId does not match objectKey");
    }
    if (legalEntityId && legalEntityId !== fromKey.legalEntityId) {
      throw new Error("legalEntityId does not match objectKey");
    }
    return {
      organizationId: fromKey.organizationId,
      legalEntityId: fromKey.legalEntityId,
      branchCode: text(job.branchCode),
      source,
      bucket: text(job.bucket),
      objectKey: fromKey.objectKey,
      payload: job.payload,
    };
  }

  const organizationId = text(job.organizationId);
  const legalEntityId = text(job.legalEntityId);
  const branchCode = text(job.branchCode);
  if (!organizationId || !legalEntityId || !branchCode) {
    throw new Error("organizationId, legalEntityId, and branchCode are required");
  }
  if (job.payload === undefined) {
    throw new Error("webhook jobs require payload");
  }
  return { organizationId, legalEntityId, branchCode, source, payload: job.payload };
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}
