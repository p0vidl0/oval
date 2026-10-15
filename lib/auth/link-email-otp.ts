import { createHash, randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { normalizeEmail } from "@/lib/auth/email";
import { db } from "@/lib/db/client";
import { verification } from "@/lib/db/schema/auth-schema";
import { sendAuthEmailOtp } from "@/lib/email/send-otp";

const PREFIX = "account-link-email:";
const TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 3;

type Stored = {
  linkToken: string;
  email: string;
  otpHash: string;
  attempts: number;
};

function identifier(linkToken: string): string {
  return `${PREFIX}${linkToken}`;
}

function hashOtp(otp: string): string {
  return createHash("sha256").update(otp).digest("hex");
}

export function generateEmailLinkOtp(): string {
  const n = randomBytes(4).readUInt32BE(0) % 1_000_000;
  return n.toString().padStart(6, "0");
}

export async function sendEmailLinkOtp(
  linkToken: string,
  emailInput: string,
): Promise<{ ok: true } | { ok: false; reason: "invalid_email" }> {
  const email = normalizeEmail(emailInput);
  if (!email) return { ok: false, reason: "invalid_email" };

  const otp = generateEmailLinkOtp();
  await sendAuthEmailOtp(email, otp);

  const value: Stored = {
    linkToken,
    email,
    otpHash: hashOtp(otp),
    attempts: 0,
  };

  const rows = await db
    .select({ id: verification.id })
    .from(verification)
    .where(eq(verification.identifier, identifier(linkToken)))
    .limit(1);

  if (rows[0]) {
    await db
      .update(verification)
      .set({
        value: JSON.stringify(value),
        expiresAt: new Date(Date.now() + TTL_MS),
        updatedAt: new Date(),
      })
      .where(eq(verification.id, rows[0].id));
  } else {
    await db.insert(verification).values({
      id: crypto.randomUUID(),
      identifier: identifier(linkToken),
      value: JSON.stringify(value),
      expiresAt: new Date(Date.now() + TTL_MS),
    });
  }

  return { ok: true };
}

export async function verifyEmailLinkOtp(
  linkToken: string,
  otpInput: string,
): Promise<
  | { ok: true; email: string }
  | { ok: false; reason: "expired" | "invalid" | "too_many" }
> {
  const otp = otpInput.trim();
  const rows = await db
    .select()
    .from(verification)
    .where(eq(verification.identifier, identifier(linkToken)))
    .limit(1);
  const row = rows[0];
  if (!row || row.expiresAt <= new Date()) {
    return { ok: false, reason: "expired" };
  }

  let stored: Stored;
  try {
    stored = JSON.parse(row.value) as Stored;
  } catch {
    return { ok: false, reason: "invalid" };
  }

  if (stored.linkToken !== linkToken) {
    return { ok: false, reason: "invalid" };
  }

  if (stored.attempts >= MAX_ATTEMPTS) {
    return { ok: false, reason: "too_many" };
  }

  if (hashOtp(otp) !== stored.otpHash) {
    stored.attempts += 1;
    await db
      .update(verification)
      .set({ value: JSON.stringify(stored), updatedAt: new Date() })
      .where(eq(verification.id, row.id));
    return { ok: false, reason: "invalid" };
  }

  await db.delete(verification).where(eq(verification.id, row.id));
  return { ok: true, email: stored.email };
}

export async function clearEmailLinkOtp(linkToken: string): Promise<void> {
  await db
    .delete(verification)
    .where(and(eq(verification.identifier, identifier(linkToken))));
}
