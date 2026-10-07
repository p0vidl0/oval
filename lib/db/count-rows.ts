import { type SQL, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { db } from "@/lib/db/client";

/** `select count(*) from table where …` — для пагинации. */
export async function countRows(table: PgTable, where: SQL | undefined) {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(table)
    .where(where);
  return rows[0]?.count ?? 0;
}
