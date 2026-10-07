import type { TelegramProfile } from "@/lib/auth/telegram/types";

export type TelegramInitDataUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
};

export function telegramProfileFromInitDataUser(
  user: TelegramInitDataUser,
): TelegramProfile | null {
  if (!Number.isFinite(user.id)) return null;
  return {
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
    username: user.username,
    photoUrl: user.photo_url,
  };
}

export function parseTelegramInitDataUserJson(
  raw: string | undefined,
): TelegramProfile | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as TelegramInitDataUser;
    return telegramProfileFromInitDataUser(parsed);
  } catch {
    return null;
  }
}
