import {
  type ExternalSignInContext,
  signInWithExternalProfile,
} from "@/lib/auth/external-sign-in";
import { telegramDisplayName } from "@/lib/auth/telegram/display-name";
import type { TelegramProfile } from "@/lib/auth/telegram/types";

export type TelegramSignInContext = ExternalSignInContext;

export async function signInWithTelegramProfile(
  ctx: TelegramSignInContext,
  profile: TelegramProfile,
) {
  return signInWithExternalProfile(ctx, {
    providerId: "telegram",
    accountId: String(profile.id),
    name: telegramDisplayName(profile),
    email: null,
    image: profile.photoUrl,
  });
}
