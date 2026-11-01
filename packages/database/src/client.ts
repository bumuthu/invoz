import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl) {
  const runtimeEnv = process.env;
  runtimeEnv.DATABASE_URL = databaseUrl;
}

const globalForPrisma = globalThis as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
