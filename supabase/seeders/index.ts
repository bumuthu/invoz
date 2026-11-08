import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertOrganizationSlug,
  isOrganizationSlug,
  portalRoles,
  tableColumns,
  type TableName,
  type Tables,
} from "@invoz/common";

export type AuthUserSeed = {
  ref?: string;
  email: string;
  password: string;
  name?: string;
};

export type SeedRow<T extends TableName> = Partial<Tables[T]> & {
  ref?: string;
};

export type SeedDocument = {
  auth_users?: AuthUserSeed[];
} & {
  [K in TableName]?: SeedRow<K>[];
};

export const seedTables = Object.keys(tableColumns) as TableName[];

const seedersRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const seedEnvironments = new Set(["stag", "prod"]);
const skippedFiles = new Set(["sftp.json"]);

function assertSeedEnvironment(env: string): void {
  if (!seedEnvironments.has(env)) {
    throw new Error("environment must be stag or prod");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, "utf8")) as unknown;
}

function assertKnownKeys(document: SeedDocument, file: string): void {
  const known = new Set<string>(["auth_users", ...seedTables]);
  for (const key of Object.keys(document)) {
    if (!known.has(key)) {
      throw new Error(`${file} has unknown key ${key}`);
    }
  }
}

function appendRows(document: SeedDocument, file: string, value: unknown): void {
  if (!isRecord(value)) {
    throw new Error(`${file} must be a JSON object`);
  }
  assertKnownKeys(value as SeedDocument, file);
  for (const [key, rows] of Object.entries(value)) {
    if (!Array.isArray(rows)) {
      throw new Error(`${file} ${key} must be an array`);
    }
    const current = ((document as Record<string, unknown[]>)[key] ?? []) as unknown[];
    (document as Record<string, unknown[]>)[key] = [...current, ...rows];
  }
}

export function listSeedSlugs(env: string): string[] {
  assertSeedEnvironment(env);
  const directory = path.join(seedersRoot, env);
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new Error(`seeder environment not found: supabase/seeders/${env}`);
    }
    throw error;
  }
  const slugs: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    if (!isOrganizationSlug(entry.name)) {
      throw new Error(`supabase/seeders/${env}/${entry.name} is not an organization slug`);
    }
    slugs.push(entry.name);
  }
  return slugs.sort();
}

export function loadSeed(env: string, slug: string): SeedDocument {
  assertSeedEnvironment(env);
  assertOrganizationSlug(slug);
  const directory = path.join(seedersRoot, env, slug);
  const location = `supabase/seeders/${env}/${slug}`;
  let fileNames: string[];
  try {
    fileNames = readdirSync(directory).filter((name) => name.endsWith(".json")).sort();
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new Error(`seeder not found: ${location}`);
    }
    throw error;
  }
  if (!fileNames.includes("owner.json")) {
    throw new Error(`${location} needs owner.json`);
  }

  const document: SeedDocument = {};
  for (const name of fileNames) {
    if (skippedFiles.has(name)) {
      continue;
    }
    appendRows(document, `${slug}/${name}`, readJson(path.join(directory, name)));
  }

  document.auth_users = (document.auth_users ?? []).map((user) => {
    if (!user.ref) {
      throw new Error(`${slug} auth user is missing ref`);
    }
    if (typeof user.password !== "string" || user.password === "") {
      throw new Error(`${slug} auth user ${user.ref} is missing a password`);
    }
    return user;
  });

  for (const membership of document.memberships ?? []) {
    if (membership.role !== undefined && !(portalRoles as readonly string[]).includes(membership.role)) {
      throw new Error("memberships.role must be a portal role");
    }
  }

  const organizations = document.organizations ?? [];
  if (organizations.length !== 1 || organizations[0]?.slug !== slug) {
    throw new Error(`${location} must contain one organization with that slug`);
  }
  const owners = (document.memberships ?? []).filter((membership) => membership.role === "owner");
  if (owners.length !== 1) {
    throw new Error(`${slug} must have one owner membership`);
  }

  return document;
}
