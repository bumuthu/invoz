import postgres from "postgres";
import { connectEngine } from "./connect";
import type { Sql } from "./sql";

export async function postgresClient(databaseUrl: string): Promise<Sql> {
  return wrap(await connectEngine(databaseUrl));
}

function wrap(sql: postgres.Sql): Sql {
  return {
    async query<T extends Record<string, unknown>>(text: string, params: unknown[] = []) {
      const rows = await sql.unsafe(text, params as never[]);
      return { rows: [...rows] as unknown as T[] };
    },
    transaction(fn) {
      return sql.begin(async (tx) => fn(wrap(tx as unknown as postgres.Sql))) as Promise<never>;
    },
  };
}
