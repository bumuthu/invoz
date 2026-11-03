import {
  assertBranchCode,
  assertOrganizationSlug,
  assertPositiveInt,
  assertTin,
  isOrganizationSlug,
} from "@invoz/common";

export type OnboardingBranch = {
  code: string;
  name: string;
};

export type OnboardingLegalEntity = {
  name: string;
  tin: string;
  vat_number: string | null;
  branches: OnboardingBranch[];
};

export type OnboardingDocument = {
  organization: {
    name: string;
    slug: string;
    monthly_allowance: number;
  };
  owner: {
    name: string;
    email: string;
    password?: string;
  };
  legal_entities: OnboardingLegalEntity[];
};

export type OnboardingResult = {
  organization_id: number;
  slug: string;
  name: string;
  owner_email: string;
  owner_user_id: string;
  owner_password: string | null;
  owner_created: boolean;
  legal_entities: {
    id: number;
    name: string;
    tin: string;
    branches: { id: number; code: string; name: string }[];
  }[];
  sftp_prefix: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(record: Record<string, unknown>, key: string, label: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} is required`);
  }
  return value.trim();
}

function rejectUnknown(record: Record<string, unknown>, allowed: string[], label: string): void {
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) {
      throw new Error(`${label} has unknown field ${key}`);
    }
  }
}

export function parseOnboarding(value: unknown): OnboardingDocument {
  if (!isRecord(value)) {
    throw new Error("onboarding file must be a JSON object");
  }
  rejectUnknown(value, ["organization", "owner", "legal_entities"], "onboarding file");
  if (!isRecord(value.organization)) {
    throw new Error("organization is required");
  }
  if (!isRecord(value.owner)) {
    throw new Error("owner is required");
  }
  if (!Array.isArray(value.legal_entities) || value.legal_entities.length === 0) {
    throw new Error("legal_entities must contain at least one legal entity");
  }

  rejectUnknown(value.organization, ["name", "slug", "monthly_allowance"], "organization");
  rejectUnknown(value.owner, ["name", "email", "password"], "owner");

  const name = requiredString(value.organization, "name", "organization.name");
  const slug = requiredString(value.organization, "slug", "organization.slug").toLowerCase();
  assertOrganizationSlug(slug);
  const allowance = value.organization.monthly_allowance ?? 500;
  if (typeof allowance !== "number") {
    throw new Error("organization.monthly_allowance must be a number");
  }
  assertPositiveInt(allowance, "monthly_allowance");

  const ownerName = requiredString(value.owner, "name", "owner.name");
  const email = requiredString(value.owner, "email", "owner.email").toLowerCase();
  if (!emailPattern.test(email)) {
    throw new Error("owner.email must be an email address");
  }
  let password: string | undefined;
  if (value.owner.password !== undefined) {
    if (typeof value.owner.password !== "string" || value.owner.password.length < 8) {
      throw new Error("owner.password must be at least 8 characters");
    }
    password = value.owner.password;
  }

  const tins = new Set<string>();
  const legalEntities = value.legal_entities.map((entity, index) => {
    if (!isRecord(entity)) {
      throw new Error(`legal_entities[${index}] must be an object`);
    }
    rejectUnknown(entity, ["name", "tin", "vat_number", "branches"], `legal_entities[${index}]`);
    const entityName = requiredString(entity, "name", `legal_entities[${index}].name`);
    const tin = requiredString(entity, "tin", `legal_entities[${index}].tin`);
    assertTin(tin);
    if (tins.has(tin)) {
      throw new Error(`duplicate tin ${tin}`);
    }
    tins.add(tin);
    let vatNumber: string | null = null;
    if (entity.vat_number !== undefined && entity.vat_number !== null) {
      if (typeof entity.vat_number !== "string") {
        throw new Error(`legal_entities[${index}].vat_number must be a string`);
      }
      vatNumber = entity.vat_number.trim() || null;
    }
    if (!Array.isArray(entity.branches) || entity.branches.length === 0) {
      throw new Error(`legal_entities[${index}] needs at least one branch`);
    }
    const codes = new Set<string>();
    const branches = entity.branches.map((branch, branchIndex) => {
      if (!isRecord(branch)) {
        throw new Error(`legal_entities[${index}].branches[${branchIndex}] must be an object`);
      }
      rejectUnknown(branch, ["code", "name"], `legal_entities[${index}].branches[${branchIndex}]`);
      const code = requiredString(branch, "code", `legal_entities[${index}].branches[${branchIndex}].code`);
      assertBranchCode(code);
      if (codes.has(code)) {
        throw new Error(`duplicate branch code ${code} on tin ${tin}`);
      }
      codes.add(code);
      return {
        code,
        name: requiredString(branch, "name", `legal_entities[${index}].branches[${branchIndex}].name`),
      };
    });
    return { name: entityName, tin, vat_number: vatNumber, branches };
  });

  return {
    organization: { name, slug, monthly_allowance: allowance },
    owner: { name: ownerName, email, ...(password ? { password } : {}) },
    legal_entities: legalEntities,
  };
}

export function onboardingFileName(slug: string): string {
  if (!isOrganizationSlug(slug)) {
    throw new Error("slug must be a hostname label, and not www, admin, app, or api");
  }
  return `${slug}.json`;
}
