import type { TelegramProfile } from "@/lib/auth/telegram/types";

export function telegramDisplayName(profile: TelegramProfile): string {
  const parts = [profile.firstName, profile.lastName]
    .map((p) => p?.trim())
    .filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  if (profile.username?.trim()) return `@${profile.username.trim()}`;
  return `Telegram ${profile.id}`;
}
