import { prisma } from "@invoz/database";
import { loadSeed, loadSystemSeed } from "../seeders";
import { applySeeds } from "./apply-seed";

function usage(): string {
  return `Usage: npm run onboard -- <stag|prod> <organization slug>

Reads supabase/seeders/<env>/<slug> and creates the organization, its config, and the owner account.
Re-running the same slug fills in anything missing and does not reset an existing password.`;
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

  const document = loadSeed(env, slug);
  await applySeeds([loadSystemSeed(), document]);

  const organization = await prisma.organization.findUnique({
    where: { slug },
    include: {
      legalEntities: { include: { branches: true }, orderBy: { id: "asc" } },
    },
  });
  if (!organization) {
    throw new Error(`organization ${slug} was not created`);
  }

  const ownerMembership = document.memberships?.find((membership) => membership.role === "owner");
  const owner = document.auth_users?.find((user) => user.ref === ownerMembership?.user_id);
  await prisma.auditLog.create({
    data: {
      organization_id: organization.id,
      event: "organization.onboarded",
      detail: { slug, owner_email: owner?.email ?? null },
    },
  });

  console.log(`organization ${organization.id} ${organization.slug}`);
  for (const entity of organization.legalEntities) {
    console.log(`legal entity ${entity.id} ${entity.tin} ${entity.name}`);
    for (const branch of [...entity.branches].sort((left, right) => left.code.localeCompare(right.code))) {
      console.log(`branch ${branch.id} ${branch.code} ${branch.name}`);
    }
  }
  console.log(`owner ${owner?.email ?? "missing"}`);
  console.log(`sftp prefix uploads/${organization.id}/`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
