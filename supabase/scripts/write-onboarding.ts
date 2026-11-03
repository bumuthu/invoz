import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertOrganizationSlug, assertTin, isTin } from "@invoz/common";
import { onboardingFileName, parseOnboarding, type OnboardingDocument } from "./onboarding-document";

const onboardingDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "onboarding");

type EntityDraft = {
  name: string;
  tin: string;
  vatNumber: string | null;
  branches: { code: string; name: string }[];
};

function usage(): string {
  return `Usage: npm run onboard:json -- --name "Acme (Pvt) Ltd" --slug acme --owner-name "Ayesha Fernando" --owner-email owner@acme.lk --tin 102345678 --branch "HO|Head office"

One legal entity (name defaults to the organization name):
  --tin 102345678
  --vat 102345678-7000          optional
  --branch "HO|Head office"     repeat for each branch

Several legal entities:
  --entity "Acme (Pvt) Ltd|102345678"
  --entity "Acme Exports|109876543|109876543-7000"
  --branch "102345678|HO|Head office"
  --branch "109876543|EXP|Exports"

--allowance 500                 optional, default 500
--password "..."                optional, at least 8 characters. Omit to generate one when the organization is created.
--force                         overwrite an existing file
--out path                      optional output path`;
}

const knownFlags = new Set([
  "name",
  "slug",
  "owner-name",
  "owner-email",
  "allowance",
  "password",
  "force",
  "out",
  "entity",
  "branch",
  "tin",
  "vat",
  "help",
]);

function args(argv: string[]): Map<string, string[]> {
  const values = new Map<string, string[]>();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      throw new Error(`unexpected argument ${token}\n${usage()}`);
    }
    const name = token.slice(2);
    if (!knownFlags.has(name)) {
      throw new Error(`unknown option --${name}\n${usage()}`);
    }
    if (name === "force") {
      values.set(name, ["true"]);
      continue;
    }
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      throw new Error(`missing value for --${name}\n${usage()}`);
    }
    index += 1;
    const list = values.get(name) ?? [];
    list.push(next);
    values.set(name, list);
  }
  return values;
}

function one(values: Map<string, string[]>, name: string): string | undefined {
  const list = values.get(name);
  if (!list) return undefined;
  if (list.length > 1) {
    throw new Error(`--${name} can be set once`);
  }
  return list[0];
}

function required(values: Map<string, string[]>, name: string): string {
  const value = one(values, name);
  if (!value || value.trim() === "") {
    throw new Error(`--${name} is required\n${usage()}`);
  }
  return value.trim();
}

function split(value: string, count: number, label: string): string[] {
  const parts = value.split("|").map((part) => part.trim());
  if (parts.length !== count || parts.some((part) => part === "")) {
    throw new Error(`${label} must look like ${count === 2 ? "CODE|Name" : "TIN|CODE|Name"}`);
  }
  return parts;
}

function documentFrom(values: Map<string, string[]>): OnboardingDocument {
  const organizationName = required(values, "name");
  const slug = required(values, "slug").toLowerCase();
  assertOrganizationSlug(slug);
  const ownerName = required(values, "owner-name");
  const ownerEmail = required(values, "owner-email");
  const allowanceText = one(values, "allowance");
  const allowance = allowanceText === undefined ? 500 : Number(allowanceText);
  if (!Number.isInteger(allowance)) {
    throw new Error("--allowance must be a positive integer");
  }
  const password = one(values, "password");
  const entities = values.get("entity") ?? [];
  const branches = values.get("branch") ?? [];
  const tin = one(values, "tin");
  const vat = one(values, "vat");

  if (entities.length > 0 && (tin || vat)) {
    throw new Error("use --entity for several legal entities, without --tin or --vat");
  }
  if (branches.length === 0) {
    throw new Error("add at least one --branch");
  }

  const drafts = new Map<string, EntityDraft>();
  if (entities.length === 0) {
    if (!tin) {
      throw new Error("--tin is required when --entity is omitted");
    }
    assertTin(tin);
    drafts.set(tin, {
      name: organizationName,
      tin,
      vatNumber: vat?.trim() || null,
      branches: [],
    });
    for (const branch of branches) {
      const [code, branchName] = split(branch, 2, "--branch");
      drafts.get(tin)?.branches.push({ code, name: branchName });
    }
  } else {
    for (const entity of entities) {
      const parts = entity.split("|").map((part) => part.trim());
      if (parts.length < 2 || parts.length > 3 || parts.slice(0, 2).some((part) => part === "")) {
        throw new Error('--entity must look like "Name|TIN" or "Name|TIN|VAT number"');
      }
      const [entityName, entityTin, entityVat] = parts;
      assertTin(entityTin);
      if (drafts.has(entityTin)) {
        throw new Error(`duplicate tin ${entityTin}`);
      }
      drafts.set(entityTin, {
        name: entityName,
        tin: entityTin,
        vatNumber: entityVat?.trim() || null,
        branches: [],
      });
    }
    for (const branch of branches) {
      const [branchTin, code, branchName] = split(branch, 3, "--branch");
      if (!isTin(branchTin)) {
        throw new Error(`--branch tin ${branchTin} must be 9 digits`);
      }
      const draft = drafts.get(branchTin);
      if (!draft) {
        throw new Error(`--branch tin ${branchTin} has no matching --entity`);
      }
      draft.branches.push({ code, name: branchName });
    }
  }

  return parseOnboarding({
    organization: {
      name: organizationName,
      slug,
      monthly_allowance: allowance,
    },
    owner: {
      name: ownerName,
      email: ownerEmail,
      ...(password ? { password } : {}),
    },
    legal_entities: [...drafts.values()].map((entity) => ({
      name: entity.name,
      tin: entity.tin,
      vat_number: entity.vatNumber,
      branches: entity.branches,
    })),
  });
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv.includes("--help")) {
    console.log(usage());
    if (argv.length === 0) process.exitCode = 1;
    return;
  }
  const values = args(argv);
  const document = documentFrom(values);
  const target = one(values, "out")
    ? path.resolve(one(values, "out") as string)
    : path.join(onboardingDir, onboardingFileName(document.organization.slug));
  await mkdir(path.dirname(target), { recursive: true });
  try {
    await writeFile(target, `${JSON.stringify(document, null, 2)}\n`, {
      flag: values.has("force") ? "w" : "wx",
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      throw new Error(`${target} already exists. Pass --force to overwrite it.`);
    }
    throw error;
  }
  console.log(target);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
