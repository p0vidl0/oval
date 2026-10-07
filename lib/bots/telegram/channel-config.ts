import { getTelegramBotToken } from "@/lib/auth/telegram/config";

export function getTelegramChannelId(): string | undefined {
  const raw = process.env.TELEGRAM_CHANNEL_ID?.trim();
  return raw || undefined;
}

export function isTelegramChannelPublishConfigured(): boolean {
  return Boolean(getTelegramBotToken() && getTelegramChannelId());
}
