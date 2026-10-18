import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";

const roots = ["migrations"].map((name) => path.resolve(process.cwd(), name));

async function sqlFiles(directory: string): Promise<string[]> {
  const names = await readdir(directory);
  return names
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => path.join(directory, name));
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required. Copy supabase/.env.example to supabase/.env.");
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query(`
      create table if not exists schema_migrations (
        version text primary key,
        applied_at timestamptz not null default now()
      )
    `);
    await client.query("alter table schema_migrations enable row level security");
    await client.query("revoke all on table schema_migrations from anon, authenticated");

    const applied = await client.query<{ version: string }>(
      "select version from schema_migrations",
    );
    const done = new Set(applied.rows.map((row) => row.version));

    const files = (await Promise.all(roots.map((root) => sqlFiles(root)))).flat();

    for (const file of files) {
      const version = path.basename(file);
      if (done.has(version)) {
        console.log(`skip ${version}`);
        continue;
      }

      const sql = await readFile(file, "utf8");
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into schema_migrations (version) values ($1)", [version]);
        await client.query("commit");
        console.log(`applied ${version}`);
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
