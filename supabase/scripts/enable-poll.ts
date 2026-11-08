import { assertOrganizationSlug } from "@invoz/common";
import { prisma } from "@invoz/database";

function usage(): string {
  return `Usage: npm run enable:poll -- <stag|prod> <organization slug> <erp code>

Sets that organization's polling connection for the ERP to live and approves its pending enable request.
Turns polling on for the organization. Reads supabase/.env, the same database as npm run onboard.`;
}

function erpCode(value: string): string {
  if (!/^[a-z][a-z0-9_]*$/.test(value)) {
    throw new Error("erp code must be a lowercase ERP code such as s4hana");
  }
  return value;
}

async function main() {
  const env = process.argv[2];
  const slug = process.argv[3];
  const codeArg = process.argv[4];
  if (!env || env === "--help" || !slug || !codeArg || process.argv.length > 5) {
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
  const code = erpCode(codeArg);

  const organization = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true, slug: true, polling_enabled: true },
  });
  if (!organization) {
    throw new Error(`organization ${slug} was not found. Run npm run onboard -- ${env} ${slug}`);
  }

  const connections = await prisma.erpConnection.findMany({
    where: { organization_id: organization.id, ingestion_mode: "poll", erp_code: code },
    include: { changeRequests: { where: { status: "pending" } } },
    orderBy: { id: "asc" },
  });
  if (connections.length === 0) {
    throw new Error(`organization ${slug} has no ${code} polling connection. Request one from the portal first.`);
  }

  for (const connection of connections) {
    if (connection.changeRequests.length > 1) {
      throw new Error(`polling connection ${connection.id} has more than one pending request`);
    }
    if (connection.changeRequests[0]?.action === "disable") {
      throw new Error(`polling connection ${connection.id} has a pending disable request`);
    }
  }

  const changed = connections.filter(
    (connection) => connection.status !== "live" || connection.changeRequests.length > 0,
  );
  const enablePolling = !organization.polling_enabled;
  if (changed.length > 0 || enablePolling) {
    const decidedAt = new Date();
    await prisma.$transaction(async (tx) => {
      if (enablePolling) {
        await tx.organization.update({
          where: { id: organization.id },
          data: { polling_enabled: true },
        });
      }
      for (const connection of changed) {
        const request = connection.changeRequests[0];
        if (connection.status !== "live") {
          await tx.erpConnection.update({
            where: { id: connection.id },
            data: { status: "live" },
          });
        }
        if (request) {
          await tx.erpChangeRequest.update({
            where: { id: request.id },
            data: { status: "approved", decided_at: decidedAt },
          });
        }
        await tx.auditLog.create({
          data: {
            organization_id: organization.id,
            event: "erp.enabled",
            detail: {
              env,
              ingestionMode: "poll",
              erp: connection.erp_code,
              label: connection.label,
              connectionId: String(connection.id),
              requestId: request ? String(request.id) : null,
              pollingEnabled: true,
            },
          },
        });
      }
      if (enablePolling && changed.length === 0) {
        await tx.auditLog.create({
          data: {
            organization_id: organization.id,
            event: "erp.enabled",
            detail: { env, ingestionMode: "poll", erp: code, pollingEnabled: true },
          },
        });
      }
    });
  }

  console.log(`organization ${organization.id} ${organization.slug}`);
  console.log("polling on");
  for (const connection of connections) {
    const label = connection.label ? ` ${connection.label}` : "";
    console.log(`poll ${connection.id} ${connection.erp_code}${label} live`);
    const request = connection.changeRequests[0];
    if (request) console.log(`request ${request.id} approved`);
  }
  if (changed.length === 0 && !enablePolling) {
    console.log("already live");
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
