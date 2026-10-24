/**
 * Backfill миграций на данных старой модели: тестовая база мигрирует с нуля,
 * поэтому UPDATE в миграциях иначе никогда не выполняются в тестах.
 *
 * Отдельная временная база: миграции до 0013 (одна ось `status`), строки во
 * всех старых статусах, затем остальные миграции разом — как drizzle на проде.
 */
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const run = process.env.OVAL_INTEGRATION === "1" ? describe : describe.skip;

/** Последняя миграция модели с одним `registrations.status`. */
const LAST_OLD_MIGRATION = "0013_curious_sugar_man";

type Journal = { entries: { tag: string }[] } & Record<string, unknown>;

/** Папка миграций, обрезанная по `lastTag` включительно. */
function migrationsUpTo(lastTag: string) {
  const source = path.resolve("drizzle");
  const dir = mkdtempSync(path.join(tmpdir(), "oval-migrations-"));
  mkdirSync(path.join(dir, "meta"));
  const journal = JSON.parse(
    readFileSync(path.join(source, "meta/_journal.json"), "utf8"),
  ) as Journal;
  const cut = journal.entries.findIndex((e) => e.tag === lastTag);
  if (cut < 0) throw new Error(`No migration ${lastTag}`);
  const entries = journal.entries.slice(0, cut + 1);
  for (const entry of entries) {
    cpSync(
      path.join(source, `${entry.tag}.sql`),
      path.join(dir, `${entry.tag}.sql`),
    );
  }
  writeFileSync(
    path.join(dir, "meta/_journal.json"),
    JSON.stringify({ ...journal, entries }),
  );
  return dir;
}

run("migrations backfill", () => {
  const dbName = `oval_backfill_${Date.now()}`;
  let admin: ReturnType<typeof postgres>;
  let client: ReturnType<typeof postgres>;
  let oldMigrations: string;

  beforeAll(async () => {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is required");
    admin = postgres(url, { max: 1 });
    await admin.unsafe(`CREATE DATABASE ${dbName}`);
    const target = new URL(url);
    target.pathname = `/${dbName}`;
    client = postgres(target.toString(), { max: 1, onnotice: () => {} });
    oldMigrations = migrationsUpTo(LAST_OLD_MIGRATION);
    await migrate(drizzle(client), { migrationsFolder: oldMigrations });

    await client.unsafe(`
      INSERT INTO "user"(id, name, email, email_verified, created_at, updated_at) VALUES
        ('u1','U1','u1@x',true,now(),now()), ('u2','U2','u2@x',true,now(),now());
      INSERT INTO training_sessions(id, title, starts_at, price_cents, capacity, status, online_payment_enabled) VALUES
        ('s_paid','Paid',now()+interval '1 day',50000,10,'scheduled',true),
        ('s_free','Free',now()+interval '1 day',0,10,'scheduled',true),
        ('s2','P2',now()+interval '2 day',50000,10,'scheduled',true),
        ('s3','P3',now()+interval '3 day',50000,10,'scheduled',true);
      INSERT INTO registrations(id, user_id, training_session_id, status, cancelled_by) VALUES
        ('r_pending','u1','s_paid','pending_payment',null),
        ('r_paid','u2','s_paid','paid',null),
        ('r_free','u1','s_free','paid',null),
        ('r_cancel_free','u2','s_free','cancelled','user'),
        ('r_refunded','u1','s2','refunded',null),
        ('r_transferred','u2','s2','transferred',null),
        ('r_cancel_session','u1','s3','cancelled','session_cancelled');
      INSERT INTO payments(id, user_id, registration_id, amount_cents, status, provider, metadata) VALUES
        ('p_online','u1','r_pending',50000,'pending','mock','{}'),
        ('p_onsite_meta','u2','r_paid',50000,'succeeded','mock','{"source":"admin_onsite"}'),
        ('p_onsite_delivery','u1','r_refunded',50000,'cancelled','mock','{}');
      INSERT INTO payment_webhook_deliveries(id, provider, payment_id, payload) VALUES
        ('mock:admin_onsite-x-1','mock','p_onsite_delivery','{"source":"admin_onsite"}');
    `);

    // Все новые миграции разом, в одной транзакции — как `db:migrate` на проде.
    await migrate(drizzle(client), {
      migrationsFolder: path.resolve("drizzle"),
    });
  }, 60_000);

  afterAll(async () => {
    await client?.end();
    await admin?.unsafe(`DROP DATABASE IF EXISTS ${dbName}`);
    await admin?.end();
    if (oldMigrations) rmSync(oldMigrations, { recursive: true, force: true });
  });

  it("splits the old status into participation and payment axes", async () => {
    const rows = await client.unsafe(
      `SELECT id, status, payment_state, cancelled_by, attendance, source
       FROM registrations ORDER BY id`,
    );
    expect(
      Object.fromEntries(
        rows.map((r) => [r.id, [r.status, r.payment_state, r.cancelled_by]]),
      ),
    ).toEqual({
      r_cancel_free: ["cancelled", "free", "user"],
      r_cancel_session: ["cancelled", "due", "session_cancelled"],
      r_free: ["active", "free", null],
      r_paid: ["active", "paid", null],
      r_pending: ["active", "due", null],
      r_refunded: ["cancelled", "refunded", "admin"],
      r_transferred: ["cancelled", "moved", "transferred"],
    });
    expect(
      rows.every((r) => r.attendance === "unknown" && r.source === "self"),
    ).toBe(true);
  });

  it("marks old on-site payments as cash, others stay online", async () => {
    const rows = await client.unsafe(
      "SELECT id, method FROM payments ORDER BY id",
    );
    expect(Object.fromEntries(rows.map((r) => [r.id, r.method]))).toEqual({
      p_online: "online",
      p_onsite_delivery: "cash",
      p_onsite_meta: "cash",
    });
  });

  it("makes the unique index partial: re-registering adds a row", async () => {
    await client.unsafe(`
      INSERT INTO registrations(id, user_id, training_session_id, status, payment_state)
      VALUES ('r_again','u2','s_free','active','free')
    `);
    await expect(
      client.unsafe(`
        INSERT INTO registrations(id, user_id, training_session_id, status, payment_state)
        VALUES ('r_dup','u2','s_free','active','free')
      `),
    ).rejects.toThrow();
  });
});
