import { createHmac, timingSafeEqual } from "node:crypto";
import {
  getTelegramBotToken,
  getTelegramLoginIntentTtlSec,
} from "@/lib/auth/telegram/config";
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

function buildDataCheckString(params: URLSearchParams): string {
  const pairs: string[] = [];
  for (const [key, value] of params.entries()) {
    if (key === "hash") continue;
    pairs.push(`${key}=${value}`);
  }
  pairs.sort();
  return pairs.join("\n");
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
  const params = new URLSearchParams(fields);
  const dataCheckString = buildDataCheckString(params);
  const hash = computeInitDataHash(dataCheckString, botToken).toString("hex");
  params.set("hash", hash);
  return params.toString();
}

export function verifyTelegramInitData(
  initData: string,
  botToken?: string,
): VerifiedTelegramInitData | null {
  const token = botToken ?? getTelegramBotToken();
  if (!token?.trim() || !initData?.trim()) return null;

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(initData);
  } catch {
    return null;
  }

  const receivedHash = params.get("hash");
  if (!receivedHash || !/^[a-f0-9]{64}$/i.test(receivedHash)) return null;

  const dataCheckString = buildDataCheckString(params);
  const calculated = computeInitDataHash(dataCheckString, token);
  const received = Buffer.from(receivedHash, "hex");
  if (
    calculated.length !== received.length ||
    !timingSafeEqual(calculated, received)
  ) {
    return null;
  }

  const authDateRaw = params.get("auth_date");
  const authDate = authDateRaw ? Number.parseInt(authDateRaw, 10) : Number.NaN;
  if (!Number.isFinite(authDate)) return null;

  const nowSec = Math.floor(Date.now() / 1000);
  if (authDate > nowSec + 60) return null;
  if (nowSec - authDate > initDataMaxAgeSec()) return null;

  const profile = parseTelegramInitDataUserJson(
    params.get("user") ?? undefined,
  );
  if (!profile) return null;

  const startParam = params.get("start_param") ?? undefined;

  return {
    profile,
    authDate,
    startParam: startParam || undefined,
  };
}
