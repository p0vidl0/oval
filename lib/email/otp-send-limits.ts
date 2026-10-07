import { and, desc, eq, gte, lt } from "drizzle-orm";
import { normalizeEmail } from "@/lib/auth/email";
import { db } from "@/lib/db/client";
import { countRows } from "@/lib/db/count-rows";
import { emailOtpSendLog } from "@/lib/db/schema";
import {
  decideOtpSendAllowed,
  readOtpSendLimitConfig,
} from "@/lib/email/otp-send-limit-policy";
import { isTestApiEnabled } from "@/lib/test-api";

const MS_HOUR = 3_600_000;
const MS_DAY = 86_400_000;
const RETENTION_MS = 48 * MS_HOUR;

export {
  decideOtpSendAllowed,
  type OtpSendLimitConfig,
  type OtpSendLimitSnapshot,
  readOtpSendLimitConfig,
} from "@/lib/email/otp-send-limit-policy";

/** SMTP prod limits; off for stub/recording and when test API is on. */
export function otpSendLimitsEnabled(): boolean {
  if (isTestApiEnabled()) return false;
  return (process.env.EMAIL_PROVIDER?.trim() || "stub") === "smtp";
}

export async function checkOtpSendAllowed(
  emailRaw: string,
): Promise<{ allowed: true } | { allowed: false; reason: string }> {
  const email = normalizeEmail(emailRaw) ?? emailRaw.trim().toLowerCase();
  const now = new Date();
  const config = readOtpSendLimitConfig();
  const hourAgo = new Date(now.getTime() - MS_HOUR);
  const dayAgo = new Date(now.getTime() - MS_DAY);

  const [lastRow] = await db
    .select({ sentAt: emailOtpSendLog.sentAt })
    .from(emailOtpSendLog)
    .where(eq(emailOtpSendLog.email, email))
    .orderBy(desc(emailOtpSendLog.sentAt))
    .limit(1);

  const sendsLast24h = await countRows(
    emailOtpSendLog,
    and(eq(emailOtpSendLog.email, email), gte(emailOtpSendLog.sentAt, dayAgo)),
  );

  const sendsLastHourGlobal = await countRows(
    emailOtpSendLog,
    gte(emailOtpSendLog.sentAt, hourAgo),
  );

  return decideOtpSendAllowed({
    now,
    lastSentAt: lastRow?.sentAt ?? null,
    sendsLast24h,
    sendsLastHourGlobal,
    config,
  });
}

export async function recordOtpSend(emailRaw: string): Promise<void> {
  const email = normalizeEmail(emailRaw) ?? emailRaw.trim().toLowerCase();
  const cutoff = new Date(Date.now() - RETENTION_MS);

  await db.transaction(async (tx) => {
    await tx.insert(emailOtpSendLog).values({
      id: crypto.randomUUID(),
      email,
    });
    await tx.delete(emailOtpSendLog).where(lt(emailOtpSendLog.sentAt, cutoff));
  });
}
