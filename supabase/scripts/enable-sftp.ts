import { assertOrganizationSlug } from "@invoz/common";
import { prisma } from "@invoz/database";

function usage(): string {
  return `Usage: npm run enable:sftp -- <stag|prod> <organization slug>

Sets that organization's SFTP connection to live and approves its pending enable request.
Reads supabase/.env, the same database as npm run onboard.`;
}

async function main() {
  const env = process.argv[2];
  const slug = process.argv[3];
  if (!env || env === "--help" || !slug || process.argv.length > 4) {
    console.log(usage());
    if (!env || env !== "--help" || process.argv.length > 3) {
      process.exitCode = 1;
    }
    return;
  }
  if (env !== "stag" && env !== "prod") {
    throw new Error("environment must be stag or prod");
  }
  assertOrganizationSlug(slug);

  const organization = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true, slug: true },
  });
  if (!organization) {
    throw new Error(`organization ${slug} was not found. Run npm run onboard -- ${env} ${slug}`);
  }

  const connections = await prisma.erpConnection.findMany({
    where: { organization_id: organization.id, ingestion_mode: "sftp" },
    include: { changeRequests: { where: { status: "pending" } } },
  });
  if (connections.length === 0) {
    throw new Error(`organization ${slug} has no SFTP connection. Request one from the portal first.`);
  }
  if (connections.length > 1) {
    throw new Error(`organization ${slug} has more than one SFTP connection`);
  }

  const connection = connections[0];
  const pending = connection.changeRequests;
  if (pending.length > 1) {
    throw new Error(`SFTP connection ${connection.id} has more than one pending request`);
  }
  const request = pending[0];
  if (request?.action === "disable") {
    throw new Error(`SFTP connection ${connection.id} has a pending disable request`);
  }

  const changed = connection.status !== "live" || request !== undefined;
  if (changed) {
    await prisma.$transaction(async (tx) => {
      if (connection.status !== "live") {
        await tx.erpConnection.update({
          where: { id: connection.id },
          data: { status: "live" },
        });
      }
      if (request) {
        await tx.erpChangeRequest.update({
          where: { id: request.id },
          data: { status: "approved", decided_at: new Date() },
        });
      }
      await tx.auditLog.create({
        data: {
          organization_id: organization.id,
          event: "erp.enabled",
          detail: {
            env,
            ingestionMode: "sftp",
            erp: connection.erp_code,
            connectionId: String(connection.id),
            requestId: request ? String(request.id) : null,
          },
        },
      });
    });
  }

  console.log(`organization ${organization.id} ${organization.slug}`);
  console.log(`sftp ${connection.id} ${connection.erp_code} live`);
  if (request) {
    console.log(`request ${request.id} approved`);
  } else if (!changed) {
    console.log("already live");
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
