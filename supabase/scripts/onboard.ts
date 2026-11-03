import { randomBytes } from "node:crypto";
import { chmod, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "@invoz/database";
import { createClient } from "@supabase/supabase-js";
import { parseOnboarding, type OnboardingDocument, type OnboardingResult } from "./onboarding-document";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function usage(): string {
  return `Usage: npm run onboard -- supabase/onboarding/<slug>.json

Creates the organization, its legal entities and branches, and the owner account.
Re-running the same file fills in anything missing and does not reset an existing password.
The owner password, when created, is printed once and written to <slug>.result.json.`;
}

function generatedPassword(): string {
  return randomBytes(18).toString("base64url");
}

async function resolveInput(arg: string): Promise<string> {
  const candidates = [path.resolve(arg), path.resolve(repoRoot, arg)];
  for (const candidate of candidates) {
    try {
      await readFile(candidate);
      return candidate;
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
        throw error;
      }
    }
  }
  throw new Error(`onboarding file not found: ${arg}`);
}

async function authUserId(email: string): Promise<string | undefined> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    select id from auth.users where lower(email) = ${email}
  `;
  return rows[0]?.id;
}

async function createAuthUser(
  email: string,
  password: string,
  name: string,
): Promise<{ id: string; created: boolean }> {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to create the owner");
  }
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const created = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (created.error || !created.data.user) {
    const message = created.error?.message ?? "Auth user was not created";
    if (/already|registered|exists/i.test(message)) {
      const existing = await authUserId(email);
      if (existing) return { id: existing, created: false };
    }
    throw new Error(message);
  }
  return { id: created.data.user.id, created: true };
}

async function ensureOwner(
  document: OnboardingDocument,
): Promise<{ userId: string; created: boolean; password: string | null }> {
  const existing = await authUserId(document.owner.email);
  if (existing) {
    return { userId: existing, created: false, password: null };
  }
  const password = document.owner.password ?? generatedPassword();
  const created = await createAuthUser(document.owner.email, password, document.owner.name);
  return {
    userId: created.id,
    created: created.created,
    password: created.created ? password : null,
  };
}

async function apply(document: OnboardingDocument, ownerId: string): Promise<Omit<OnboardingResult, "owner_password" | "owner_created" | "owner_user_id" | "owner_email">> {
  return prisma.$transaction(async (tx) => {
    let organization = await tx.organization.findUnique({ where: { slug: document.organization.slug } });
    if (!organization) {
      organization = await tx.organization.create({
        data: {
          name: document.organization.name,
          slug: document.organization.slug,
          monthly_allowance: document.organization.monthly_allowance,
        },
      });
    }

    const owner = await tx.membership.findFirst({
      where: { organization_id: organization.id, role: "owner" },
    });
    if (owner && owner.user_id !== ownerId) {
      throw new Error(`${document.organization.slug} already has a different owner`);
    }
    const membership = await tx.membership.findUnique({
      where: { user_id_organization_id: { user_id: ownerId, organization_id: organization.id } },
    });
    if (membership && membership.role !== "owner") {
      throw new Error(`${document.owner.email} is already a ${membership.role} of ${document.organization.slug}`);
    }
    if (!membership) {
      await tx.membership.create({
        data: { user_id: ownerId, organization_id: organization.id, role: "owner" },
      });
    }

    const legalEntities: OnboardingResult["legal_entities"] = [];
    for (const entity of document.legal_entities) {
      let row = await tx.legalEntity.findUnique({
        where: { organization_id_tin: { organization_id: organization.id, tin: entity.tin } },
      });
      if (!row) {
        row = await tx.legalEntity.create({
          data: {
            organization_id: organization.id,
            name: entity.name,
            tin: entity.tin,
            vat_number: entity.vat_number,
          },
        });
      }
      const branches: OnboardingResult["legal_entities"][number]["branches"] = [];
      for (const branch of entity.branches) {
        let branchRow = await tx.branch.findUnique({
          where: { legal_entity_id_code: { legal_entity_id: row.id, code: branch.code } },
        });
        if (!branchRow) {
          branchRow = await tx.branch.create({
            data: { legal_entity_id: row.id, code: branch.code, name: branch.name },
          });
        }
        branches.push({ id: Number(branchRow.id), code: branchRow.code, name: branchRow.name });
      }
      legalEntities.push({ id: Number(row.id), name: row.name, tin: row.tin, branches });
    }

    await tx.auditLog.create({
      data: {
        organization_id: organization.id,
        event: "organization.onboarded",
        detail: { slug: organization.slug, owner_email: document.owner.email },
      },
    });

    return {
      organization_id: Number(organization.id),
      slug: organization.slug,
      name: organization.name,
      legal_entities: legalEntities,
      sftp_prefix: `uploads/${organization.id}/`,
    };
  });
}

function resultPath(input: string): string {
  const parsed = path.parse(input);
  return path.join(parsed.dir, `${parsed.name}.result.json`);
}

async function main() {
  const file = process.argv[2];
  if (!file || file === "--help" || process.argv.length > 3) {
    console.log(usage());
    if (!file) process.exitCode = 1;
    return;
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required. Run npm run migrate before this script.");
  }

  const input = await resolveInput(file);
  const document = parseOnboarding(JSON.parse(await readFile(input, "utf8")));
  const owner = await ensureOwner(document);
  const applied = await apply(document, owner.userId);
  const result: OnboardingResult = {
    ...applied,
    owner_email: document.owner.email,
    owner_user_id: owner.userId,
    owner_password: owner.created ? owner.password : null,
    owner_created: owner.created,
  };
  const output = resultPath(input);
  await writeFile(output, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
  await chmod(output, 0o600);

  console.log(`organization ${result.organization_id} ${result.slug}`);
  for (const entity of result.legal_entities) {
    console.log(`legal entity ${entity.id} ${entity.tin} ${entity.name}`);
    for (const branch of entity.branches) {
      console.log(`branch ${branch.id} ${branch.code} ${branch.name}`);
    }
  }
  console.log(`owner ${result.owner_email} ${result.owner_created ? "created" : "already exists"}`);
  if (result.owner_password) {
    console.log(`password ${result.owner_password}`);
  } else {
    console.log("password unchanged");
  }
  console.log(`sftp prefix ${result.sftp_prefix}`);
  console.log(`result ${output}`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
