import { parseInvoiceJob, type LegalEntityRow } from "@invoz/common";
import type { SQSHandler } from "aws-lambda";
import { createClient } from "@supabase/supabase-js";

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
  const client = supabase();
  const { data, error } = await client
    .from("legal_entities")
    .select("id, organization_id")
    .eq("id", job.legalEntityId)
    .maybeSingle<Pick<LegalEntityRow, "id" | "organization_id">>();

  if (error) {
    throw new Error(error.message);
  }
  if (!data || data.organization_id !== job.organizationId) {
    throw new Error("legal entity is not in the organization on this job");
  }

  throw new Error("RAMIS submission is not implemented");
}

export const handler: SQSHandler = async (event) => {
  const batchItemFailures: { itemIdentifier: string }[] = [];

  for (const record of event.Records) {
    try {
      await processInvoiceJob(parseInvoiceJob(record.body));
    } catch (error) {
      console.error("invoice-engine failed", record.messageId, error);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
};
