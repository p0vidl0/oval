import { isTelegramOidcConfigured } from "@/lib/auth/telegram/oidc-config";

const DEFAULT_INTENT_TTL_SEC = 300;

export function getTelegramBotToken(): string | undefined {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  return token || undefined;
}

export function getTelegramBotUsername(): string | undefined {
  const username = process.env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "");
  return username || undefined;
}

export function getTelegramWebhookSecret(): string | undefined {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  return secret || undefined;
}

export function getTelegramLoginIntentTtlSec(): number {
  const raw = process.env.TELEGRAM_LOGIN_INTENT_TTL_SEC?.trim();
  if (!raw) return DEFAULT_INTENT_TTL_SEC;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_INTENT_TTL_SEC;
}

export function isTelegramBotLoginConfigured(): boolean {
  return Boolean(getTelegramBotToken() && getTelegramBotUsername());
}

/** OIDC (web) or bot deep link — show Telegram block on /login */
export function isTelegramLoginConfigured(): boolean {
  return isTelegramOidcConfigured() || isTelegramBotLoginConfigured();
}

export function getTelegramDeepLink(startPayload: string): string {
  const username = getTelegramBotUsername();
  if (!username) throw new Error("TELEGRAM_BOT_USERNAME not configured");
  return `https://t.me/${username}?start=${encodeURIComponent(startPayload)}`;
}
