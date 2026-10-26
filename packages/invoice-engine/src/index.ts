import { createHash } from "node:crypto";
import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, NoSuchKey, S3Client } from "@aws-sdk/client-s3";
import { isSettledInvoiceKey, isTin, parseInvoiceJob, type InvoiceClass } from "@invoz/common";
import { prisma, type Prisma } from "@invoz/database";
import type { SQSHandler } from "aws-lambda";
import { alertRamisClearedCommitFailed } from "./alert";
import { invoicesFromCsv, type MappedInvoice } from "./invoices";
import { idempotencyKey, RamisRejection, ramisPayload, submitInvoice, type Clearance } from "./ramis";

const s3 = new S3Client({});

type Entity = { id: number; organization_id: number; name: string; tin: string };

export async function processInvoiceJob(job: ReturnType<typeof parseInvoiceJob>): Promise<void> {
  if (job.source !== "s3" || !job.bucket || !job.objectKey) {
    throw new Error("s3 jobs require bucket and objectKey");
  }
  const entity = await legalEntity(job.legalEntityId, job.organizationId);
  const csv = await readInvoice(job.bucket, job.objectKey);
  if (csv === undefined) return;

  const mappings = await prisma.fieldMapping.findMany({
    where: { legal_entity_id: BigInt(entity.id) },
    select: { source_column: true, target_field: true },
  });
  const invoices = invoicesFromCsv(csv, mappings);
  let rejected = false;
  for (const invoice of invoices) {
    const outcome = await submitMappedInvoice(entity, job.objectKey, job.branchId, invoice);
    if (outcome === "rejected") rejected = true;
  }
  await moveInvoice(job.bucket, job.objectKey, rejected ? "rejected" : "processed");
}

async function legalEntity(legalEntityId: number, organizationId: number): Promise<Entity> {
  const row = await prisma.legalEntity.findUnique({
    where: { id: BigInt(legalEntityId) },
    select: { id: true, organization_id: true, name: true, tin: true },
  });
  if (!row || Number(row.organization_id) !== organizationId) {
    throw new Error("legal entity is not in the organization on this job");
  }
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
    throw new Error(`branch code ${invoice.branchCode} does not match branch ${branch.id}`);
  }

  let clearance: Clearance | undefined;
  let serialNumber = "";
  try {
    return await prisma.$transaction(
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
          return existing.ramis_status === "cleared" ? "cleared" : "rejected";
        }

        serialNumber = existing?.serial_number ?? (await nextSerial(tx, branch.id, invoice.invoiceDate));
        const payload = ramisPayload(invoice, serialNumber, entity, branch.name);
        const hash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
        const invoiceId = existing?.id ?? (await insertQueued(tx, entity, branch.id, branch.name, invoice, serialNumber, hash));

        clearance = await submitInvoice(payload, idempotencyKey(objectKey, invoice.erpReference));
        await tx.outboundInvoice.update({
          where: { id: invoiceId },
          data: {
            ramis_status: "cleared",
            ramis_clearance_token: clearance.token,
            ramis_payload_hash: clearance.hash,
            cleared_at: new Date(clearance.clearedAt),
            error_message: null,
          },
        });
        return "cleared";
      },
      { timeout: 55_000, maxWait: 10_000 },
    );
  } catch (error) {
    if (error instanceof RamisRejection) return "rejected";
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
    }
    throw error;
  }
}

async function nextSerial(tx: Prisma.TransactionClient, branchId: bigint, invoiceDate: string): Promise<string> {
  const result = await tx.$queryRaw<{ serial: string }[]>`
    select next_gazette_serial(${branchId}::bigint, ${invoiceDate}::date) as serial
  `;
  const serial = result[0]?.serial;
  if (!serial) throw new Error("next serial was not returned");
  return serial;
}

async function insertQueued(
  tx: Prisma.TransactionClient,
  entity: Entity,
  branchId: bigint,
  placeOfSupply: string,
  invoice: MappedInvoice,
  serialNumber: string,
  hash: string,
): Promise<bigint> {
  const exempt = Number(invoice.vatAmount) === 0;
  const invoiceType: InvoiceClass = exempt ? "exempt" : "standard";
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
      vat_rate: exempt ? "0.00" : "18.00",
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

export const handler: SQSHandler = async (event) => {
  const batchItemFailures: { itemIdentifier: string }[] = [];

  for (const record of event.Records) {
    console.log("invoice-engine received", record.messageId, record.body);
    try {
      const job = JSON.parse(record.body) as { source?: unknown; objectKey?: unknown };
      if (job.source === "s3" && typeof job.objectKey === "string" && isSettledInvoiceKey(job.objectKey)) {
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
