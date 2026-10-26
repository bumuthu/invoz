import { createHash } from "node:crypto";
import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, NoSuchKey, S3Client } from "@aws-sdk/client-s3";
import {
  isSettledInvoiceKey,
  isTin,
  parseInvoiceJob,
  type BranchRow,
  type FieldMappingRow,
  type InvoiceClass,
  type LegalEntityRow,
  type OutboundInvoiceRow,
} from "@invoz/common";
import type { SQSHandler } from "aws-lambda";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { invoicesFromCsv, type MappedInvoice } from "./invoices";
import { idempotencyKey, RamisRejection, ramisPayload, submitInvoice } from "./ramis";

const s3 = new S3Client({});

function supabase() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function processInvoiceJob(job: ReturnType<typeof parseInvoiceJob>): Promise<void> {
  if (job.source !== "s3" || !job.bucket || !job.objectKey) {
    throw new Error("s3 jobs require bucket and objectKey");
  }
  const client = supabase();
  const entity = await legalEntity(client, job.legalEntityId, job.organizationId);
  const csv = await readInvoice(job.bucket, job.objectKey);
  if (csv === undefined) return;

  const { data: mappings, error: mappingError } = await client
    .from("field_mappings")
    .select("source_column, target_field")
    .eq("legal_entity_id", entity.id);
  if (mappingError) throw new Error(mappingError.message);

  const invoices = invoicesFromCsv(csv, (mappings ?? []) as Pick<FieldMappingRow, "source_column" | "target_field">[]);
  let rejected = false;
  for (const invoice of invoices) {
    const outcome = await submitMappedInvoice(client, entity, job.objectKey, job.branchId, invoice);
    if (outcome === "rejected") rejected = true;
  }
  await moveInvoice(job.bucket, job.objectKey, rejected ? "rejected" : "processed");
}

async function legalEntity(client: SupabaseClient, legalEntityId: string, organizationId: string) {
  const { data, error } = await client
    .from("legal_entities")
    .select("id, organization_id, name, tin")
    .eq("id", legalEntityId)
    .maybeSingle<Pick<LegalEntityRow, "id" | "organization_id" | "name" | "tin">>();
  if (error) throw new Error(error.message);
  if (!data || data.organization_id !== organizationId) {
    throw new Error("legal entity is not in the organization on this job");
  }
  if (!isTin(data.tin)) throw new Error("legal entity TIN must be 9 digits");
  return data;
}

async function submitMappedInvoice(
  client: SupabaseClient,
  entity: Pick<LegalEntityRow, "id" | "organization_id" | "name" | "tin">,
  objectKey: string,
  branchId: string | undefined,
  invoice: MappedInvoice,
): Promise<"cleared" | "rejected"> {
  console.log("invoice-engine invoice", JSON.stringify(invoice));
  let branchQuery = client
    .from("branches")
    .select("id, name, code")
    .eq("legal_entity_id", entity.id);
  branchQuery = branchId ? branchQuery.eq("id", branchId) : branchQuery.eq("code", invoice.branchCode);
  const { data: branch, error: branchError } = await branchQuery.maybeSingle<Pick<BranchRow, "id" | "name" | "code">>();
  if (branchError) throw new Error(branchError.message);
  if (!branch) throw new Error(`branch ${branchId ?? invoice.branchCode} is not in this legal entity`);
  if (branch.code !== invoice.branchCode) {
    throw new Error(`branch code ${invoice.branchCode} does not match branch ${branch.id}`);
  }

  const existing = await existingInvoice(client, entity.id, invoice.erpReference);
  if (existing?.ramis_status === "cleared") return "cleared";
  if (existing?.ramis_status === "rejected") return "rejected";

  const serialNumber = existing?.serial_number ?? (await nextSerial(client, branch.id, invoice.invoiceDate));
  const payload = ramisPayload(invoice, serialNumber, entity, branch.name);
  const hash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  const invoiceId =
    existing?.id ?? (await insertQueued(client, entity, branch.id, branch.name, invoice, serialNumber, hash));

  try {
    const clearance = await submitInvoice(payload, idempotencyKey(objectKey, invoice.erpReference));
    const { error } = await client
      .from("outbound_invoices")
      .update({
        ramis_status: "cleared",
        ramis_clearance_token: clearance.token,
        ramis_payload_hash: clearance.hash,
        cleared_at: clearance.clearedAt,
        error_message: null,
      })
      .eq("id", invoiceId);
    if (error) throw new Error(error.message);
    return "cleared";
  } catch (error) {
    if (!(error instanceof RamisRejection)) throw error;
    const { error: updateError } = await client
      .from("outbound_invoices")
      .update({ ramis_status: "rejected", error_message: error.message })
      .eq("id", invoiceId);
    if (updateError) throw new Error(updateError.message);
    return "rejected";
  }
}

async function existingInvoice(client: SupabaseClient, legalEntityId: string, erpReference: string) {
  const { data, error } = await client
    .from("outbound_invoices")
    .select("id, serial_number, ramis_status")
    .eq("legal_entity_id", legalEntityId)
    .eq("erp_reference", erpReference)
    .maybeSingle<Pick<OutboundInvoiceRow, "id" | "serial_number" | "ramis_status">>();
  if (error) throw new Error(error.message);
  return data;
}

async function nextSerial(client: SupabaseClient, branchId: string, invoiceDate: string): Promise<string> {
  const { data, error } = await client.rpc("next_gazette_serial", { p_branch_id: branchId, p_on: invoiceDate });
  if (error) throw new Error(error.message);
  if (typeof data !== "string" || data === "") throw new Error("next serial was not returned");
  return data;
}

async function insertQueued(
  client: SupabaseClient,
  entity: Pick<LegalEntityRow, "id" | "organization_id">,
  branchId: string,
  placeOfSupply: string,
  invoice: MappedInvoice,
  serialNumber: string,
  hash: string,
): Promise<string> {
  const exempt = Number(invoice.vatAmount) === 0;
  const invoiceType: InvoiceClass = exempt ? "exempt" : "standard";
  const { data, error } = await client
    .from("outbound_invoices")
    .insert({
      organization_id: entity.organization_id,
      legal_entity_id: entity.id,
      branch_id: branchId,
      serial_number: serialNumber,
      erp_reference: invoice.erpReference,
      invoice_type: invoiceType,
      invoice_date: invoice.invoiceDate,
      supply_date: invoice.supplyDate,
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
    })
    .select("id")
    .single<{ id: string }>();
  if (error) throw new Error(error.message);
  return data.id;
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
