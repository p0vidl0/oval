/**
 * Assign role by email. Example:
 *   pnpm run user:role -- admin@example.com admin
 *
 * Users who signed in only via Telegram may have no email — promote by id in SQL until link-email exists.
 */
import { eq } from "drizzle-orm";
import { normalizeEmail } from "@/lib/auth/email";
import { db } from "@/lib/db/client";
import { user } from "@/lib/db/schema";

const ROLES = ["user", "editor", "admin"] as const;

const emailArg = process.argv[2];
const roleArg = process.argv[3] as (typeof ROLES)[number];

if (!emailArg || !roleArg || !ROLES.includes(roleArg)) {
  console.error(`Usage: pnpm run user:role -- <email> <${ROLES.join("|")}>`);
  process.exit(1);
}

const email = normalizeEmail(emailArg);
if (!email) {
  console.error("Invalid email");
  process.exit(1);
}

const rows = await db.select().from(user).where(eq(user.email, email));
if (rows.length === 0) {
  console.error(
    `No user with email ${email}. Sign in once via email OTP first.`,
  );
  process.exit(1);
}

await db.update(user).set({ role: roleArg }).where(eq(user.id, rows[0].id));
console.info(`Updated ${email} → role=${roleArg}`);
