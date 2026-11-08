import { createHash } from "node:crypto";
import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, NoSuchKey, S3Client } from "@aws-sdk/client-s3";
import { isSettledInvoiceKey, isTin, parseInvoiceJob, parseResubmitJob, readErpFieldMap, type InvoiceClass, type InvoiceJob } from "@invoz/common";
import { prisma, type Prisma } from "@invoz/database";
import type { SQSHandler } from "aws-lambda";
import { alertRamisClearedCommitFailed } from "./alert";
import { isTransient, isUniqueConflict, messageOf } from "./failure";
import { invoicesFromCsv, type MappedInvoice } from "./invoices";
import { processResubmit } from "./resubmit";
import { idempotencyKey, ramisPayload, submitInvoice, type Clearance } from "@invoz/common/ramis";

const pathTargets: Record<string, string> = {
  "header.invoice_date": "Invoice date",
  "header.supply_date": "Supply date",
  "purchaser.tin": "Buyer TIN",
  "purchaser.name": "Buyer name",
  "currency_summary.total_value_excluding_vat": "Net amount",
  "currency_summary.total_vat_amount": "VAT amount",
  "header.invoice_type": "Invoice type",
  "header.erp_reference": "ERP reference",
};

const s3 = new S3Client({});

type Entity = { id: number; organization_id: number; name: string; tin: string };

export async function processInvoiceJob(job: InvoiceJob): Promise<void> {
  if (job.source !== "s3" || !job.bucket || !job.objectKey) {
    throw new Error("s3 jobs require bucket and objectKey");
  }
  const bucket = job.bucket;
  const objectKey = job.objectKey;
  try {
    await publishInvoiceFile(job, bucket, objectKey);
  } catch (error) {
    if (isTransient(error)) throw error;
    const message = messageOf(error);
    console.error("invoice-engine rejected", objectKey, message);
    await storeFileException(job, message);
    await moveInvoice(bucket, objectKey, "rejected");
  }
}

async function publishInvoiceFile(job: InvoiceJob, bucket: string, objectKey: string): Promise<void> {
  const erpCode = await erpCodeForInvoice(job.organizationId, objectKey);
  const entity = await legalEntity(job.legalEntityId, job.organizationId);
  const csv = await readInvoice(bucket, objectKey);
  if (csv === undefined) return;

  const mappings = await mappingsForInvoice(erpCode);
  const branch = job.branchId
    ? await prisma.branch.findFirst({
        where: { id: BigInt(job.branchId), legal_entity_id: BigInt(entity.id) },
        select: { code: true },
      })
    : null;
  const invoices = invoicesFromCsv(csv, mappings, branch?.code);
  let rejected = false;
  for (const invoice of invoices) {
    const outcome = await submitMappedInvoice(entity, objectKey, job.branchId, invoice);
    if (outcome === "rejected") rejected = true;
  }
  await clearFileException(entity.id, objectKey, job.branchId);
  await moveInvoice(bucket, objectKey, rejected ? "rejected" : "processed");
}

const pollFile = /\/inbound\/poll-([a-z0-9_]+)-[^/]+\.csv$/;

async function mappingsForInvoice(
  erpCode: string,
): Promise<{ source_column: string; target_field: string }[]> {
  const stored = await prisma.erpFieldMapping.findUnique({
    where: { erp_code_schedule: { erp_code: erpCode, schedule: "01" } },
  });
  if (!stored) throw new Error(`field mapping has no schedule 01 for ${erpCode}`);
  return Object.entries(readErpFieldMap(stored.mapping)).flatMap(([erpField, ramisField]) => {
    const target = pathTargets[ramisField];
    return target ? [{ source_column: erpField, target_field: target }] : [];
  });
}

async function erpCodeForInvoice(organizationId: number, objectKey: string): Promise<string> {
  const polled = pollFile.exec(objectKey);
  if (polled) {
    const code = polled[1];
    const connection = await prisma.erpConnection.findFirst({
      where: {
        organization_id: BigInt(organizationId),
        erp_code: code,
        ingestion_mode: "poll",
      },
      select: { status: true },
    });
    if (connection?.status === "live") return code;
    throw new Error("erp connection is not live");
  }
  const sftp = await prisma.erpConnection.findMany({
    where: { organization_id: BigInt(organizationId), ingestion_mode: "sftp" },
    select: { erp_code: true, status: true },
  });
  if (sftp.length > 1) throw new Error("organization has more than one SFTP integration");
  const connection = sftp[0];
  if (connection?.status === "live") return connection.erp_code;
  throw new Error("erp connection is not live");
}

async function legalEntity(legalEntityId: number, organizationId: number): Promise<Entity> {
  const row = await prisma.legalEntity.findUnique({
    where: { id: BigInt(legalEntityId) },
    select: { id: true, organization_id: true, name: true, tin: true, ramis_enabled: true },
  });
  if (!row || Number(row.organization_id) !== organizationId) {
    throw new Error("legal entity is not in the organization on this job");
  }
  if (!row.ramis_enabled) throw new Error("ramis connection is disabled");
  if (!isTin(row.tin)) throw new Error("legal entity TIN must be 9 digits");
  return { id: Number(row.id), organization_id: Number(row.organization_id), name: row.name, tin: row.tin };
}

async function submitMappedInvoice(
  entity: Entity,
  objectKey: string,
  branchId: number | undefined,
  invoice: MappedInvoice,
): Promise<"cleared" | "rejected"> {
  console.log("invoice-engine invoice", JSON.stringify(invoice));
  const branch = await prisma.branch.findFirst({
    where: branchId
      ? { id: BigInt(branchId), legal_entity_id: BigInt(entity.id) }
      : { legal_entity_id: BigInt(entity.id), code: invoice.branchCode },
    select: { id: true, name: true, code: true },
  });
  if (!branch) throw new Error(`branch ${branchId ?? invoice.branchCode} is not in this legal entity`);
  if (branch.code !== invoice.branchCode) {
    return saveRejection(
      entity,
      branch.id,
      branch.name,
      invoice,
      `branch code ${invoice.branchCode} does not match branch ${branch.id}`,
    );
  }

  let clearance: Clearance | undefined;
  let serialNumber = "";
  try {
    const prepared = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`select set_config('statement_timeout', '55s', true)`;
        await tx.$executeRaw`select set_config('idle_in_transaction_session_timeout', '55s', true)`;

        const locked = await tx.$queryRaw<{ id: bigint; serial_number: string | null; ramis_status: string }[]>`
          select id, serial_number, ramis_status
          from outbound_invoices
          where legal_entity_id = ${BigInt(entity.id)} and erp_reference = ${invoice.erpReference}
          for update
        `;
        const existing = locked[0];
        if (existing?.ramis_status === "cleared" || existing?.ramis_status === "rejected") {
          return { outcome: existing.ramis_status === "cleared" ? "cleared" : "rejected" } as const;
        }

        serialNumber = existing?.serial_number ?? (await nextSerial(tx, branch.id, invoice.invoiceDate));
        const invoiceType = storedClass(invoice);
        const payload = ramisPayload(invoice, serialNumber, entity, branch.name, invoiceType);
        const hash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
        const invoiceId = existing
          ? existing.id
          : await insertQueued(tx, entity, branch.id, branch.name, invoice, serialNumber, hash, invoiceType);
        return { outcome: "submit" as const, invoiceId, payload, serialNumber };
      },
      { timeout: 55_000, maxWait: 10_000 },
    );
    if (prepared.outcome !== "submit") return prepared.outcome;
    serialNumber = prepared.serialNumber;
    clearance = await submitInvoice(prepared.payload, idempotencyKey(objectKey, invoice.erpReference));
    await prisma.outboundInvoice.update({
      where: { id: prepared.invoiceId },
      data: {
        ramis_status: "cleared",
        ramis_clearance_token: clearance.token,
        ramis_payload_hash: clearance.hash,
        cleared_at: new Date(clearance.clearedAt),
        error_message: null,
      },
    });
    return "cleared";
  } catch (error) {
    if (clearance) {
      alertRamisClearedCommitFailed({
        organizationId: entity.organization_id,
        legalEntityId: entity.id,
        branchId: Number(branch.id),
        erpReference: invoice.erpReference,
        serialNumber,
        clearanceToken: clearance.token,
        clearedAt: clearance.clearedAt,
        error,
      });
      throw error;
    }
    if (isTransient(error)) throw error;
    return saveRejection(entity, branch.id, branch.name, invoice, messageOf(error));
  }
}

async function saveRejection(
  entity: Entity,
  branchId: bigint,
  placeOfSupply: string,
  invoice: MappedInvoice,
  message: string,
): Promise<"cleared" | "rejected"> {
  const legalEntityId = BigInt(entity.id);
  const existing = await prisma.outboundInvoice.findFirst({
    where: { legal_entity_id: legalEntityId, erp_reference: invoice.erpReference },
    select: { id: true, ramis_status: true },
  });
  if (existing?.ramis_status === "cleared") return "cleared";
  if (existing) {
    await prisma.outboundInvoice.update({
      where: { id: existing.id },
      data: { ramis_status: "rejected", error_message: message },
    });
    return "rejected";
  }
  const invoiceType = storedClass(invoice);
  const hash = createHash("sha256").update(`reject\n${entity.id}\n${invoice.erpReference}`).digest("hex");
  try {
    await prisma.outboundInvoice.create({
      data: {
        organization_id: BigInt(entity.organization_id),
        legal_entity_id: legalEntityId,
        branch_id: branchId,
        erp_reference: invoice.erpReference,
        invoice_type: invoiceType,
        invoice_date: new Date(invoice.invoiceDate),
        supply_date: new Date(invoice.supplyDate),
        customer_tin: invoice.buyerTin,
        customer_name: invoice.buyerName,
        place_of_supply: placeOfSupply,
        currency: "LKR",
        exchange_rate: "1.0000",
        amount_exclusive_vat: invoice.netAmount,
        vat_rate: invoiceType === "financial_services" ? "20.50" : invoiceType === "standard" ? "18.00" : "0.00",
        vat_amount: invoice.vatAmount,
        total_amount: invoice.totalAmount,
        ramis_status: "rejected",
        ramis_payload_hash: hash,
        error_message: message,
      },
    });
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;
    await prisma.outboundInvoice.updateMany({
      where: { legal_entity_id: legalEntityId, erp_reference: invoice.erpReference, ramis_status: { not: "cleared" } },
      data: { ramis_status: "rejected", error_message: message },
    });
  }
  return "rejected";
}

async function nextSerial(tx: Prisma.TransactionClient, branchId: bigint, invoiceDate: string): Promise<string> {
  const result = await tx.$queryRaw<{ serial: string }[]>`
    select next_gazette_serial(${branchId}::bigint, ${invoiceDate}::date) as serial
  `;
  const serial = result[0]?.serial;
  if (!serial) throw new Error("next serial was not returned");
  return serial;
}

function storedClass(invoice: MappedInvoice): InvoiceClass {
  const raw = invoice.invoiceType?.trim().toUpperCase();
  if (raw === "ZERO_RATED" || raw === "ZERO_RATED_INVOICE") return "zero_rated";
  if (raw === "FINANCIAL_SERVICES" || raw === "FINANCIAL_SERVICES_TAX_INVOICE") return "financial_services";
  if (raw === "EXEMPT" || raw === "EXEMPT_INVOICE" || Number(invoice.vatAmount) === 0) return "exempt";
  return "standard";
}

async function insertQueued(
  tx: Prisma.TransactionClient,
  entity: Entity,
  branchId: bigint,
  placeOfSupply: string,
  invoice: MappedInvoice,
  serialNumber: string,
  hash: string,
  invoiceType: InvoiceClass,
): Promise<bigint> {
  const created = await tx.outboundInvoice.create({
    data: {
      organization_id: BigInt(entity.organization_id),
      legal_entity_id: BigInt(entity.id),
      branch_id: branchId,
      serial_number: serialNumber,
      erp_reference: invoice.erpReference,
      invoice_type: invoiceType,
      invoice_date: new Date(invoice.invoiceDate),
      supply_date: new Date(invoice.supplyDate),
      customer_tin: invoice.buyerTin,
      customer_name: invoice.buyerName,
      place_of_supply: placeOfSupply,
      currency: "LKR",
      exchange_rate: "1.0000",
      amount_exclusive_vat: invoice.netAmount,
      vat_rate: invoiceType === "financial_services" ? "20.50" : invoiceType === "standard" ? "18.00" : "0.00",
      vat_amount: invoice.vatAmount,
      total_amount: invoice.totalAmount,
      ramis_status: "queued",
      ramis_payload_hash: hash,
    },
    select: { id: true },
  });
  return created.id;
}

async function readInvoice(bucket: string, key: string): Promise<string | undefined> {
  try {
    const output = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!output.Body) throw new Error("invoice file is empty");
    return output.Body.transformToString();
  } catch (error) {
    if (error instanceof NoSuchKey) return undefined;
    throw error;
  }
}

async function moveInvoice(bucket: string, key: string, folder: "processed" | "rejected"): Promise<void> {
  const destination = key.replace("/inbound/", `/${folder}/`);
  if (destination === key) throw new Error("invoice key is not in inbound");
  await s3.send(
    new CopyObjectCommand({
      Bucket: bucket,
      Key: destination,
      CopySource: `${bucket}/${encodeURIComponent(key).replace(/%2F/g, "/")}`,
    }),
  );
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

function fileName(objectKey: string): string {
  return objectKey.split("/").pop() || "invoice.csv";
}

function fileReference(objectKey: string, branchId?: number): string {
  return `file:${branchId ?? "entity"}:${fileName(objectKey)}`;
}

async function storeFileException(job: InvoiceJob, message: string): Promise<void> {
  if (!job.objectKey) throw new Error("s3 jobs require objectKey");
  const row = await prisma.legalEntity.findUnique({
    where: { id: BigInt(job.legalEntityId) },
    select: { id: true, organization_id: true },
  });
  if (!row || Number(row.organization_id) !== job.organizationId) {
    throw new Error("legal entity is not in the organization on this job");
  }
  const branchId = await branchForException(row.id, job.branchId);
  const erpReference = fileReference(job.objectKey, job.branchId);
  const name = fileName(job.objectKey);
  const stored = message.startsWith(`${name}: `) ? message : `${name}: ${message}`;
  const existing = await prisma.outboundInvoice.findFirst({
    where: { legal_entity_id: row.id, erp_reference: erpReference },
    select: { id: true, ramis_status: true },
  });
  if (existing?.ramis_status === "cleared") return;
  if (existing) {
    await prisma.outboundInvoice.update({
      where: { id: existing.id },
      data: { ramis_status: "rejected", error_message: stored },
    });
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  const hash = createHash("sha256").update(`file-reject\n${row.id}\n${erpReference}`).digest("hex");
  try {
    await prisma.outboundInvoice.create({
      data: {
        organization_id: row.organization_id,
        legal_entity_id: row.id,
        branch_id: branchId,
        erp_reference: erpReference,
        invoice_date: new Date(today),
        supply_date: new Date(today),
        customer_tin: "",
        customer_name: name,
        amount_exclusive_vat: "0.00",
        vat_amount: "0.00",
        total_amount: "0.00",
        ramis_status: "rejected",
        ramis_payload_hash: hash,
        error_message: stored,
      },
    });
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;
    await prisma.outboundInvoice.updateMany({
      where: { legal_entity_id: row.id, erp_reference: erpReference, ramis_status: { not: "cleared" } },
      data: { ramis_status: "rejected", error_message: stored },
    });
  }
}

async function branchForException(legalEntityId: bigint, requested?: number): Promise<bigint> {
  if (requested) {
    const branch = await prisma.branch.findFirst({
      where: { id: BigInt(requested), legal_entity_id: legalEntityId },
      select: { id: true },
    });
    if (branch) return branch.id;
  }
  const fallback = await prisma.branch.findFirst({
    where: { legal_entity_id: legalEntityId },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  if (!fallback) throw new Error("legal entity has no branch");
  return fallback.id;
}

async function clearFileException(legalEntityId: number, objectKey: string, branchId?: number): Promise<void> {
  await prisma.outboundInvoice.deleteMany({
    where: {
      legal_entity_id: BigInt(legalEntityId),
      erp_reference: fileReference(objectKey, branchId),
      ramis_status: "rejected",
      serial_number: null,
    },
  });
}

export const handler: SQSHandler = async (event) => {
  const batchItemFailures: { itemIdentifier: string }[] = [];

  for (const record of event.Records) {
    console.log("invoice-engine received", record.messageId, record.body);
    try {
      const job = JSON.parse(record.body) as { source?: unknown; objectKey?: unknown };
      if (job.source === "s3" && typeof job.objectKey === "string" && isSettledInvoiceKey(job.objectKey)) {
        continue;
      }
      if (job.source === "resubmit") {
        await processResubmit(parseResubmitJob(record.body));
        continue;
      }
      await processInvoiceJob(parseInvoiceJob(record.body));
    } catch (error) {
      console.error("invoice-engine failed", record.messageId, error);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
};
