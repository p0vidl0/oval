import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Db = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  pg: ReturnType<typeof postgres> | undefined;
  ovalDb: Db | undefined;
};

let pgClient: ReturnType<typeof postgres> | undefined;

function createDb(): Db {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  pgClient =
    globalForDb.pg ??
    postgres(connectionString, {
      max: 10,
      prepare: false,
    });

  if (process.env.NODE_ENV !== "production") {
    globalForDb.pg = pgClient;
  }

  return drizzle(pgClient, { schema });
}

function getDb(): Db {
  if (!globalForDb.ovalDb) {
    globalForDb.ovalDb = createDb();
  }
  return globalForDb.ovalDb;
}

/** Lazy pool — safe to import during `next build` without DATABASE_URL. */
export const db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    const instance = getDb();
    const value = Reflect.get(instance as object, prop, receiver);
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(instance);
    }
    return value;
  },
});

/** Close the pool (CLI seeds/scripts — otherwise the process may hang). */
export async function closeDb(): Promise<void> {
  const client = pgClient ?? globalForDb.pg;
  if (client) {
    await client.end({ timeout: 5 });
  }
  pgClient = undefined;
  globalForDb.pg = undefined;
  globalForDb.ovalDb = undefined;
}
