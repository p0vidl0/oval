import postgres from "postgres";
import { describe, expect, it } from "vitest";

const run = process.env.OVAL_INTEGRATION === "1" ? describe : describe.skip;

run("integration (oval-integration stack)", () => {
  it("connects to Postgres from rendered DATABASE_URL", async () => {
    const url = process.env.DATABASE_URL;
    expect(url).toBeDefined();
    if (!url) return;
    const sql = postgres(url, { max: 1 });
    const rows = await sql<{ ok: number }[]>`SELECT 1 as ok`;
    expect(rows[0]?.ok).toBe(1);
    await sql.end();
  });
});
