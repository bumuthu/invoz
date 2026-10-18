import {
  assertBranchCode,
  assertOrganizationSlug,
  assertPositiveInt,
  assertTin,
  portalRoles,
  tableColumns,
  type TableName,
} from "@ramis/common";
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";
import { seeds, seedTables, type SeedDocument, type SeedRow } from "../seeders";

const refs = new Map<string, string>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function bind(value: unknown): unknown {
  if (isRecord(value) || Array.isArray(value)) {
    return JSON.stringify(value);
  }
  return value;
}

function resolve(column: string, value: unknown): unknown {
  if ((column === "user_id" || column.endsWith("_id")) && typeof value === "string" && refs.has(value)) {
    return refs.get(value);
  }
  return bind(value);
}

function checkRow(table: TableName, row: Record<string, unknown>): void {
  if (table === "organizations" && typeof row.slug === "string") {
    assertOrganizationSlug(row.slug);
  }
  if (typeof row.monthly_allowance === "number") {
    assertPositiveInt(row.monthly_allowance, "monthly_allowance");
  }
  if (typeof row.tin === "string") {
    assertTin(row.tin);
  }
  if (typeof row.customer_tin === "string") {
    assertTin(row.customer_tin);
  }
  if (typeof row.supplier_tin === "string") {
    assertTin(row.supplier_tin);
  }
  if (typeof row.code === "string" && table === "branches") {
    assertBranchCode(row.code);
  }
  if (table === "memberships" && typeof row.role === "string" && !(portalRoles as readonly string[]).includes(row.role)) {
    throw new Error("memberships.role must be a portal role");
  }
}

async function insertRow(database: Client, table: TableName, row: SeedRow<TableName>): Promise<void> {
  const source = row as Record<string, unknown>;
  const ref = typeof source.ref === "string" ? source.ref : undefined;
  const allowed = new Set<string>(tableColumns[table]);
  const columns: string[] = [];
  const values: unknown[] = [];

  checkRow(table, source);

  for (const [key, value] of Object.entries(source)) {
    if (key === "ref" || value === undefined) {
      continue;
    }
    if (!allowed.has(key)) {
      throw new Error(`${table}.${key} is not a column`);
    }
    columns.push(key);
    values.push(resolve(key, value));
  }

  if (columns.length === 0) {
    throw new Error(`${table} row has no columns`);
  }

  const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
  const returnsId = allowed.has("id");
  if (ref && !returnsId) {
    throw new Error(`${table} cannot use ref because it has no id column`);
  }

  const inserted = await database.query<{ id: string }>(
    `insert into ${table} (${columns.join(", ")}) values (${placeholders})${returnsId ? " returning id" : ""}`,
    values,
  );

  if (ref) {
    if (refs.has(ref)) {
      throw new Error(`duplicate seed ref ${ref}`);
    }
    refs.set(ref, inserted.rows[0].id);
  }

  console.log(`seeded ${table}${ref ? ` ${ref}` : ""}`);
}

async function authUserId(email: string, password: string, userName?: string): Promise<string> {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to create an Auth user");
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const created = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: userName ? { name: userName } : undefined,
  });
  if (created.error || !created.data.user) {
    throw new Error(created.error?.message ?? "Auth user was not created");
  }
  return created.data.user.id;
}

async function seedAuthUsers(database: Client, documents: SeedDocument[]): Promise<void> {
  for (const document of documents) {
    for (const user of document.auth_users ?? []) {
      const email = user.email.toLowerCase();
      const existing = await database.query<{ id: string }>(
        "select id from auth.users where lower(email) = $1",
        [email],
      );
      const userId = existing.rows[0]?.id ?? (await authUserId(email, user.password, user.name));
      if (user.ref) {
        if (refs.has(user.ref)) {
          throw new Error(`duplicate seed ref ${user.ref}`);
        }
        refs.set(user.ref, userId);
      }
      refs.set(email, userId);
      console.log(`seeded auth user ${email}`);
    }
  }
}

function assertKnownKeys(document: SeedDocument): void {
  const known = new Set<string>(["auth_users", ...seedTables]);
  for (const key of Object.keys(document)) {
    if (!known.has(key)) {
      throw new Error(`unknown seed key ${key}`);
    }
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required. Run npm run migrate before this script.");
  }
  if (seeds.length === 0) {
    throw new Error("supabase/seeders has no seed objects");
  }

  for (const document of seeds) {
    assertKnownKeys(document);
  }

  const database = new Client({ connectionString: databaseUrl });
  await database.connect();

  let started = false;
  try {
    await seedAuthUsers(database, seeds);
    await database.query("begin");
    started = true;

    for (const table of seedTables) {
      for (const document of seeds) {
        for (const row of document[table] ?? []) {
          await insertRow(database, table, row);
        }
      }
    }

    await database.query("commit");
  } catch (error) {
    if (started) {
      await database.query("rollback");
    }
    throw error;
  } finally {
    await database.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
