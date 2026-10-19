import { postgresClient } from "./postgres-client";
import { PostgresStore } from "./postgres-store";
import type { Settings } from "./settings";
import { MemoryStore, type Store } from "./store";

export async function openStore(settings: Settings): Promise<Store> {
  if (!settings.databaseUrl) {
    if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
      throw new Error("RAMIS_DATABASE_URL is required");
    }
    return new MemoryStore();
  }
  return new PostgresStore(await postgresClient(settings.databaseUrl));
}
