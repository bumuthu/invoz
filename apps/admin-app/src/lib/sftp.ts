import "server-only";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { randomBytes } from "node:crypto";
import { AdminError } from "@/lib/errors";

export function appEnv(): "stag" | "prod" {
  const env = process.env.APP_ENV;
  if (env !== "stag" && env !== "prod") {
    throw new AdminError("APP_ENV must be stag or prod before an SFTP password can be issued.");
  }
  return env;
}

function region() {
  return process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ap-south-1";
}

export function newPassword(): string {
  return randomBytes(18).toString("base64url");
}

export async function transferHost(): Promise<string> {
  const env = appEnv();
  const awsRegion = region();
  const client = new SSMClient({ region: awsRegion });
  let value = "";
  try {
    const result = await client.send(new GetParameterCommand({ Name: `/invoz/${env}/transfer-server-id` }));
    value = result.Parameter?.Value?.trim() ?? "";
  } catch {
    value = "";
  }
  if (!value) {
    throw new AdminError(
      "The Transfer server is not set up for this environment. Run the SFTP deployment once, then approve again.",
    );
  }
  return `${value}.server.transfer.${awsRegion}.amazonaws.com`;
}

export async function ensureUploadPrefix(organizationId: bigint) {
  const env = appEnv();
  const client = new S3Client({ region: region() });
  await client.send(
    new PutObjectCommand({
      Bucket: `invoz-${env}-invoices`,
      Key: `uploads/${organizationId}/.keep`,
      Body: "",
    }),
  );
}
