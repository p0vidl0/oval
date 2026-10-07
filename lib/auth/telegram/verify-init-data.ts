import { createHmac, timingSafeEqual } from "node:crypto";
import {
  getTelegramBotToken,
  getTelegramLoginIntentTtlSec,
} from "@/lib/auth/telegram/config";
import {
  buildInitDataCheckString,
  parseInitDataQuery,
} from "@/lib/auth/telegram/parse-init-data-query";
import { parseTelegramInitDataUserJson } from "@/lib/auth/telegram/profile-from-init-data";
import type { TelegramProfile } from "@/lib/auth/telegram/types";

const MINI_APP_INIT_DATA_MAX_AGE_SEC = 86_400;

export type VerifiedTelegramInitData = {
  profile: TelegramProfile;
  authDate: number;
  startParam?: string;
};

function initDataMaxAgeSec(): number {
  const intentTtl = getTelegramLoginIntentTtlSec();
  return Math.max(intentTtl, MINI_APP_INIT_DATA_MAX_AGE_SEC);
}

function computeInitDataHash(
  dataCheckString: string,
  botToken: string,
): Buffer {
  const secretKey = createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
  return createHmac("sha256", secretKey).update(dataCheckString).digest();
}

/** Build signed initData for tests (same algorithm as Telegram). */
export function signTelegramInitDataForTest(
  fields: Record<string, string>,
  botToken: string,
): string {
  const map = new Map(Object.entries(fields));
  const dataCheckString = buildInitDataCheckString(map);
  const hash = computeInitDataHash(dataCheckString, botToken).toString("hex");
  const parts = [...map.entries()].map(
    ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`,
  );
  parts.push(`hash=${hash}`);
  return parts.join("&");
}

function verifyParsedFields(
  fields: Map<string, string>,
  token: string,
): VerifiedTelegramInitData | null {
  const receivedHash = fields.get("hash");
  if (!receivedHash || !/^[a-f0-9]{64}$/i.test(receivedHash)) return null;

  const dataCheckString = buildInitDataCheckString(fields);
  const calculated = computeInitDataHash(dataCheckString, token);
  const received = Buffer.from(receivedHash, "hex");
  if (
    calculated.length !== received.length ||
    !timingSafeEqual(calculated, received)
  ) {
    return null;
  }

  const authDateRaw = fields.get("auth_date");
  const authDate = authDateRaw ? Number.parseInt(authDateRaw, 10) : Number.NaN;
  if (!Number.isFinite(authDate)) return null;

  const nowSec = Math.floor(Date.now() / 1000);
  if (authDate > nowSec + 60) return null;
  if (nowSec - authDate > initDataMaxAgeSec()) return null;

  const profile = parseTelegramInitDataUserJson(fields.get("user"));
  if (!profile) return null;

  const startParam = fields.get("start_param");

  return {
    profile,
    authDate,
    startParam: startParam || undefined,
  };
}

export function verifyTelegramInitData(
  initData: string,
  botToken?: string,
): VerifiedTelegramInitData | null {
  const token = botToken ?? getTelegramBotToken();
  if (!token?.trim() || !initData?.trim()) return null;

  const fields = parseInitDataQuery(initData);
  const verified = verifyParsedFields(fields, token);
  if (verified) return verified;

  // Newer clients add `signature` (Ed25519, third-party check). Some of them
  // do not include that field in the bot-token HMAC. Retry without it.
  if (!fields.has("signature")) return null;
  const withoutSignature = new Map(fields);
  withoutSignature.delete("signature");
  return verifyParsedFields(withoutSignature, token);
}
