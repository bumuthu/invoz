import { assertOrganizationSlug } from "@invoz/common";
import { prisma } from "@invoz/database";

function usage(): string {
  return "Usage: organization-id.ts [--examples] <stag|prod> <organization slug>";
}

async function main() {
  const examples = process.argv.includes("--examples");
  const args = process.argv.slice(2).filter((arg) => arg !== "--examples");
  const env = args[0];
  const slug = args[1];
  if (!env || !slug || args.length !== 2 || (env !== "stag" && env !== "prod")) {
    throw new Error(usage());
  }
  assertOrganizationSlug(slug);

  const organization = await prisma.organization.findUnique({
    where: { slug },
    include: { legalEntities: { include: { branches: true }, orderBy: { id: "asc" } } },
  });
  if (!organization) {
    throw new Error(`organization ${slug} was not found. Run npm run onboard -- ${env} ${slug}`);
  }

  if (examples) {
    for (const entity of organization.legalEntities) {
      for (const branch of [...entity.branches].sort((left, right) => left.code.localeCompare(right.code))) {
        console.log(`example /${entity.id}/${branch.id}/inbound/invoice.csv`);
      }
    }
    return;
  }

  console.log(String(organization.id));
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
