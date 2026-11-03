import { createHash } from "node:crypto";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { invoiceMessageDeduplicationId, invoiceMessageGroupId, type ResubmitJob } from "@invoz/common";

const sqs = new SQSClient({});

export async function enqueueResubmit(job: ResubmitJob): Promise<void> {
  const queueUrl = process.env.INVOICE_QUEUE_URL?.trim();
  if (!queueUrl) throw new Error("INVOICE_QUEUE_URL is required");
  const body = JSON.stringify(job);
  const dedup = createHash("sha256").update(`${body}\n${Date.now()}`).digest("hex");
  await sqs.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: body,
      MessageGroupId: invoiceMessageGroupId(job.legalEntityId, job.branchCode),
      MessageDeduplicationId: invoiceMessageDeduplicationId(dedup),
    }),
  );
}
