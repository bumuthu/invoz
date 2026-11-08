import { prisma } from "@invoz/database";
import { listSeedSlugs, loadSeed, loadSystemSeed } from "../seeders";
import { applySeeds } from "./apply-seed";

function usage(): string {
  return `Usage: npm run seed -- <stag|prod>

Inserts supabase/seeders/system, then every organization under supabase/seeders/<env>/.`;
}

async function main() {
  const env = process.argv[2];
  if (!env || env === "--help" || process.argv.length > 3) {
    console.log(usage());
    if (!env || env !== "--help" || process.argv.length > 3) {
      process.exitCode = 1;
    }
    return;
  }

  const slugs = listSeedSlugs(env);
  if (slugs.length === 0) {
    throw new Error(`supabase/seeders/${env} has no organizations`);
  }
  await applySeeds([loadSystemSeed(), ...slugs.map((slug) => loadSeed(env, slug))]);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
