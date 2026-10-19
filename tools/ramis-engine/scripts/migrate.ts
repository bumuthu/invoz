import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { connectEngine } from "../src/connect";

const migrationsDir = path.resolve(process.cwd(), "migrations");

async function main() {
  const databaseUrl = process.env.RAMIS_DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("RAMIS_DATABASE_URL is required. Copy tools/ramis-engine/.env.example to tools/ramis-engine/.env.");
  }

  const sql = await connectEngine(databaseUrl);

  try {
    await sql.unsafe(`
      create table if not exists schema_migrations (
        version text primary key,
        applied_at timestamptz not null default now()
      )
    `);
    const applied = await sql<{ version: string }[]>`select version from schema_migrations`;
    const done = new Set(applied.map((row) => row.version));
    const names = (await readdir(migrationsDir)).filter((name) => name.endsWith(".sql")).sort();

    for (const name of names) {
      if (done.has(name)) {
        console.log(`skip ${name}`);
        continue;
      }
      const file = await readFile(path.join(migrationsDir, name), "utf8");
      await sql.begin(async (tx) => {
        await tx.unsafe(file);
        await tx`insert into schema_migrations (version) values (${name})`;
      });
      console.log(`applied ${name}`);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
