import {
  portalRoles,
  tableColumns,
  type TableName,
  type Tables,
} from "@invoz/common";
import owner from "./owner.json";
import passwords from "./passwords.json";

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

function seedDocument(value: object): SeedDocument {
  const document = value as SeedDocument;
  for (const membership of document.memberships ?? []) {
    if (
      membership.role !== undefined &&
      !(portalRoles as readonly string[]).includes(membership.role)
    ) {
      throw new Error("memberships.role must be a portal role");
    }
  }
  return document;
}

function withPasswords(value: object): SeedDocument {
  const document = value as SeedDocument;
  const byRef = new Map(passwords.map((item) => [item.ref, item.password]));
  return seedDocument({
    ...document,
    auth_users: (document.auth_users ?? []).map((user) => {
      if (!user.ref) {
        throw new Error("auth user is missing ref");
      }
      const password = byRef.get(user.ref);
      if (!password) {
        throw new Error(`missing password for ${user.ref}`);
      }
      return { ...user, password };
    }),
  });
}

export const seeds: SeedDocument[] = [withPasswords(owner)];

export const seedTables = Object.keys(tableColumns) as TableName[];
