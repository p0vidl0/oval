import { eq } from "drizzle-orm";
import { normalizeEmail } from "@/lib/auth/email";
import { db } from "@/lib/db/client";
import { verification } from "@/lib/db/schema/auth-schema";

const PREFIX = "test-email-otp:";

function identifier(email: string): string {
  const normalized = normalizeEmail(email) ?? email.trim().toLowerCase();
  return `${PREFIX}${normalized}`;
}

/** Persist OTP for e2e / integration when in-memory store is unreliable. */
export async function persistTestEmailOtp(
  email: string,
  code: string,
): Promise<void> {
  if (process.env.OVAL_TEST_API !== "1") return;
  if (!process.env.DATABASE_URL?.trim()) return;

  const normalized = normalizeEmail(email) ?? email.trim().toLowerCase();
  const id = identifier(normalized);
  const rows = await db
    .select({ rowId: verification.id })
    .from(verification)
    .where(eq(verification.identifier, id))
    .limit(1);

  const payload = JSON.stringify({ email: normalized, code });
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  if (rows[0]) {
    await db
      .update(verification)
      .set({ value: payload, expiresAt, updatedAt: new Date() })
      .where(eq(verification.id, rows[0].rowId));
  } else {
    await db.insert(verification).values({
      id: crypto.randomUUID(),
      identifier: id,
      value: payload,
      expiresAt,
    });
  }
}

export async function readPersistedTestEmailOtp(
  email: string,
): Promise<string | null> {
  if (process.env.OVAL_TEST_API !== "1") return null;
  if (!process.env.DATABASE_URL?.trim()) return null;

  const id = identifier(email);
  const rows = await db
    .select()
    .from(verification)
    .where(eq(verification.identifier, id))
    .limit(1);
  const row = rows[0];
  if (!row || row.expiresAt <= new Date()) return null;

  try {
    const parsed = JSON.parse(row.value) as { code?: string };
    return parsed.code?.trim() || null;
  } catch {
    return null;
  }
}
