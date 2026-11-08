import { hashSecret } from "@invoz/common/secret";
import { prisma } from "@invoz/database";

function usage(): string {
  return "Usage: sftp-credential.ts exists|save <organization id>";
}

function organizationId(): bigint {
  const id = process.argv[3];
  if (!id || !/^[0-9]+$/.test(id)) {
    throw new Error(usage());
  }
  return BigInt(id);
}

async function main() {
  const command = process.argv[2];
  const organizationIdValue = organizationId();
  if (command === "exists") {
    const row = await prisma.sftpCredential.findUnique({
      where: { organization_id: organizationIdValue },
      select: { organization_id: true },
    });
    if (!row) {
      process.exitCode = 1;
    }
    return;
  }
  if (command === "save") {
    const password = process.env.SFTP_PASSWORD ?? "";
    if (!password) {
      throw new Error("SFTP_PASSWORD is required");
    }
    const passwordHash = hashSecret(password);
    await prisma.sftpCredential.upsert({
      where: { organization_id: organizationIdValue },
      create: { organization_id: organizationIdValue, password_hash: passwordHash },
      update: { password_hash: passwordHash },
    });
    return;
  }
  throw new Error(usage());
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
