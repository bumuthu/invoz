import postgres from "postgres";

type Options = {
  max: number;
  idle_timeout?: number;
  connect_timeout: number;
  ssl: false | "require";
  connection?: { search_path: string };
  onnotice: () => void;
};

export async function connectEngine(databaseUrl: string): Promise<postgres.Sql> {
  const options = clientOptions(databaseUrl);
  if (!isSupabase(databaseUrl)) return connectDatabase(databaseUrl, options);
  return connectSupabaseSchema(databaseUrl, options);
}

async function connectDatabase(databaseUrl: string, options: Options): Promise<postgres.Sql> {
  const direct = postgres(databaseUrl, options);
  try {
    await direct`select 1`;
    return direct;
  } catch (error) {
    await direct.end({ timeout: 5 });
    if (!hasCode(error, "3D000")) throw error;
  }

  const url = new URL(databaseUrl);
  const name = decodeURIComponent(url.pathname.replace(/^\//, ""));
  const ident = quoteIdent(name);
  url.pathname = "/postgres";
  const admin = postgres(url.toString(), options);
  try {
    await admin.unsafe(`create database ${ident}`);
    console.log(`created database ${name}`);
  } finally {
    await admin.end({ timeout: 5 });
  }
  return postgres(databaseUrl, options);
}

async function connectSupabaseSchema(databaseUrl: string, options: Options): Promise<postgres.Sql> {
  const url = new URL(databaseUrl);
  const schema = schemaName(url);
  const ident = quoteIdent(schema);
  url.pathname = "/postgres";
  const portalUrl = url.toString();
  const admin = postgres(portalUrl, options);
  try {
    await admin.unsafe(`create schema if not exists ${ident}`);
    await dropSeparateDatabase(admin, schema);
  } finally {
    await admin.end({ timeout: 5 });
  }
  const sql = postgres(portalUrl, { ...options, connection: { search_path: engineSchema } });
  const placed = await sql<{ schema: string }[]>`select current_schema() as schema`;
  if (placed[0]?.schema !== schema) {
    await sql.end({ timeout: 5 });
    throw new Error(`search_path did not select schema ${schema}`);
  }
  return sql;
}

async function dropSeparateDatabase(admin: postgres.Sql, name: string): Promise<void> {
  quoteIdent(name);
  const existing = await admin<{ datname: string }[]>`select datname from pg_database where datname = ${name}`;
  if (existing.length === 0) return;
  const ident = quoteIdent(name);
  await admin.unsafe(
    `select pg_terminate_backend(pid) from pg_stat_activity where datname = '${name}' and pid <> pg_backend_pid()`,
  );
  await admin.unsafe(`drop database ${ident}`);
  console.log(`moved engine tables to schema ${name} in database postgres`);
}

const engineSchema = "ramis_engine";

function schemaName(url: URL): string {
  const name = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (name !== "" && name !== "postgres" && name !== engineSchema) {
    throw new Error("RAMIS_DATABASE_URL must use schema ramis_engine");
  }
  return engineSchema;
}

function isSupabase(databaseUrl: string): boolean {
  const host = new URL(databaseUrl).hostname;
  return host.endsWith(".supabase.co") || host.endsWith(".pooler.supabase.com");
}

function clientOptions(databaseUrl: string): Options {
  const local = /localhost|127\.0\.0\.1/.test(databaseUrl);
  return {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: local ? false : "require",
    onnotice: () => undefined,
  };
}

function quoteIdent(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error("RAMIS_DATABASE_URL database name must be a plain identifier");
  }
  return `"${name}"`;
}

function hasCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
