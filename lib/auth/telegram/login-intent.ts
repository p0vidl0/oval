import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  getTelegramDeepLink,
  getTelegramLoginIntentTtlSec,
} from "@/lib/auth/telegram/config";
import type { TelegramLoginIntentRecord } from "@/lib/auth/telegram/types";
import { db } from "@/lib/db/client";
import { verification } from "@/lib/db/schema/auth-schema";

const INTENT_PREFIX = "telegram-login:";

export function telegramLoginIntentIdentifier(token: string): string {
  return `${INTENT_PREFIX}${token}`;
}

export function parseTelegramLoginStartPayload(
  text: string | undefined,
): string | null {
  if (!text) return null;
  const match = text.match(/^\/start(?:@\w+)?\s+login_([A-Za-z0-9_-]+)$/);
  return match?.[1] ?? null;
}

function parseIntentValue(raw: string): TelegramLoginIntentRecord | null {
  try {
    const parsed = JSON.parse(raw) as TelegramLoginIntentRecord;
    if (parsed.status !== "pending" && parsed.status !== "ready") return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function createTelegramLoginIntent(next?: string): Promise<{
  token: string;
  deepLink: string;
  expiresIn: number;
}> {
  const ttlSec = getTelegramLoginIntentTtlSec();
  const token = randomBytes(24).toString("base64url");
  const identifier = telegramLoginIntentIdentifier(token);
  const value: TelegramLoginIntentRecord = {
    status: "pending",
    next: next?.startsWith("/") ? next : undefined,
  };
  const expiresAt = new Date(Date.now() + ttlSec * 1000);
  const id = crypto.randomUUID();

  await db.insert(verification).values({
    id,
    identifier,
    value: JSON.stringify(value),
    expiresAt,
  });

  return {
    token,
    deepLink: getTelegramDeepLink(`login_${token}`),
    expiresIn: ttlSec,
  };
}

export async function markTelegramLoginIntentReady(
  token: string,
  data: {
    telegramId: number;
    chatId: number;
    firstName?: string;
    lastName?: string;
    username?: string;
    photoUrl?: string;
  },
): Promise<TelegramLoginIntentRecord | null> {
  const identifier = telegramLoginIntentIdentifier(token);
  const rows = await db
    .select()
    .from(verification)
    .where(eq(verification.identifier, identifier))
    .limit(1);
  const row = rows[0];
  if (!row || row.expiresAt <= new Date()) return null;

  const current = parseIntentValue(row.value);
  if (!current || current.status !== "pending") return null;

  const updated: TelegramLoginIntentRecord = {
    ...current,
    status: "ready",
    telegramId: String(data.telegramId),
    chatId: data.chatId,
    firstName: data.firstName,
    lastName: data.lastName,
    username: data.username,
    photoUrl: data.photoUrl,
  };

  await db
    .update(verification)
    .set({
      value: JSON.stringify(updated),
      updatedAt: new Date(),
    })
    .where(eq(verification.id, row.id));

  return updated;
}

export async function consumeTelegramLoginIntent(
  token: string,
): Promise<TelegramLoginIntentRecord | null> {
  const identifier = telegramLoginIntentIdentifier(token);
  const rows = await db
    .select()
    .from(verification)
    .where(eq(verification.identifier, identifier))
    .limit(1);
  const row = rows[0];
  if (!row || row.expiresAt <= new Date()) {
    if (row) {
      await db.delete(verification).where(eq(verification.id, row.id));
    }
    return null;
  }

  const record = parseIntentValue(row.value);
  if (!record || record.status !== "ready" || !record.telegramId) {
    await db.delete(verification).where(eq(verification.id, row.id));
    return null;
  }

  await db.delete(verification).where(eq(verification.id, row.id));
  return record;
}
