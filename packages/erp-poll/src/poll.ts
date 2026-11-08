import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { readErpFieldMap } from "@invoz/common";
import { prisma } from "@invoz/database";
import { csvHeaders, invoiceCsv, invoiceObjectKey, type BranchRef, type PolledInvoice } from "./billing";
import { pollBillingDocuments } from "./sap";

const s3 = new S3Client({});
const minute = 60_000;
const errorBackoff = 5 * minute;

type Claimed = {
  id: bigint;
  organization_id: bigint;
  legal_entity_id: bigint | null;
  erp_code: string;
  endpoint_url: string;
  api_secret: string;
  last_invoice_id: string | null;
};

export async function runPoll(erpCode: string): Promise<void> {
  const claimed = await claimDue(erpCode);
  for (const connection of claimed) {
    try {
      await pollConnection(connection);
      await finish(connection.id, null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "SAP poll failed";
      console.error("erp-poll", String(connection.id), message);
      await finish(connection.id, message);
    }
  }
}

async function claimDue(erpCode: string): Promise<Claimed[]> {
  return prisma.$queryRaw<Claimed[]>`
    with due as (
      select c.id
      from erp_connections c
      join organizations o on o.id = c.organization_id
      where o.polling_enabled
        and c.status = 'live'
        and c.ingestion_mode = 'poll'
        and c.erp_code = ${erpCode}
        and c.endpoint_url is not null
        and btrim(c.endpoint_url) <> ''
        and c.api_secret is not null
        and btrim(c.api_secret) <> ''
        and (c.next_poll_at is null or c.next_poll_at <= now())
        and (c.poll_locked_until is null or c.poll_locked_until <= now())
      for update of c skip locked
    )
    update erp_connections c
    set poll_locked_until = now() + interval '2 minutes'
    from due
    where c.id = due.id
    returning c.id, c.organization_id, c.legal_entity_id, c.erp_code, c.endpoint_url,
      c.api_secret, c.last_invoice_id
  `;
}

async function pollConnection(connection: Claimed): Promise<void> {
  if (!connection.api_secret) {
    throw new Error("this polling config needs an API key");
  }
  const legalEntityId = await resolveLegalEntity(connection);
  const branches = (
    await prisma.branch.findMany({
      where: { legal_entity_id: BigInt(legalEntityId) },
      select: { id: true, code: true },
    })
  ).map((branch): BranchRef => ({ id: Number(branch.id), code: branch.code }));
  const stored = await prisma.erpFieldMapping.findUnique({
    where: { erp_code_schedule: { erp_code: connection.erp_code, schedule: "01" } },
  });
  if (!stored) throw new Error(`field mapping has no schedule 01 for ${connection.erp_code}`);
  const headers = csvHeaders(
    Object.entries(readErpFieldMap(stored.mapping)).map(([erpField, ramisField]) => ({ ramisField, erpField })),
  );
  const bucket = process.env.INVOICE_BUCKET;
  if (!bucket) throw new Error("INVOICE_BUCKET is required");

  await pollBillingDocuments({
    endpoint: connection.endpoint_url,
    apiKey: connection.api_secret,
    lastInvoiceId: connection.last_invoice_id,
    branches,
    write: (invoice) =>
      writeInvoice(bucket, Number(connection.organization_id), legalEntityId, connection.erp_code, headers, invoice),
    savePointer: async (invoiceId) => {
      await prisma.erpConnection.update({
        where: { id: connection.id },
        data: { last_invoice_id: invoiceId },
      });
    },
  });
}

async function writeInvoice(
  bucket: string,
  organizationId: number,
  legalEntityId: number,
  erpCode: string,
  headers: string[],
  invoice: PolledInvoice,
): Promise<void> {
  const key = invoiceObjectKey({
    organizationId,
    legalEntityId,
    branchId: invoice.branchId,
    erpCode,
    invoiceId: invoice.id,
  });
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: invoiceCsv(headers, invoice),
      ContentType: "text/csv",
    }),
  );
}

async function resolveLegalEntity(connection: Claimed): Promise<number> {
  if (connection.legal_entity_id) {
    const entity = await prisma.legalEntity.findFirst({
      where: { id: connection.legal_entity_id, organization_id: connection.organization_id },
      select: { id: true },
    });
    if (!entity) throw new Error("legal entity is missing");
    return Number(entity.id);
  }
  const entities = await prisma.legalEntity.findMany({
    where: { organization_id: connection.organization_id },
    select: { id: true },
  });
  if (entities.length === 1) return Number(entities[0].id);
  if (entities.length === 0) throw new Error("this organization has no legal entity");
  throw new Error("this polling config needs a legal entity");
}

async function finish(connectionId: bigint, error: string | null): Promise<void> {
  const now = new Date();
  await prisma.erpConnection.update({
    where: { id: connectionId },
    data: error
      ? {
          last_error: error.slice(0, 1000),
          poll_locked_until: null,
          next_poll_at: new Date(now.getTime() + errorBackoff),
        }
      : {
          last_polled_at: now,
          last_error: null,
          poll_locked_until: null,
          next_poll_at: new Date(now.getTime() + minute),
        },
  });
}
