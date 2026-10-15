import type { ProcessProviderLinkResult } from "@/lib/auth/process-provider-link";
import { processProviderLink } from "@/lib/auth/process-provider-link";
import { AUTH_PROVIDER_IDS } from "@/lib/auth/providers";
import { telegramDisplayName } from "@/lib/auth/telegram/display-name";
import type { TelegramProfile } from "@/lib/auth/telegram/types";
import type { VkSignInProfile } from "@/lib/auth/vk/oauth";

export function cabinetLinkRedirectUrl(
  baseUrl: string,
  result: ProcessProviderLinkResult,
): string {
  const url = new URL("/cabinet", baseUrl);
  url.hash = "auth-methods";

  if (result.status === "attached" || result.status === "already_linked") {
    url.searchParams.set("link", "ok");
    return url.toString();
  }
  if (result.status === "merged") {
    url.searchParams.set("link", "merged");
    return url.toString();
  }
  if (result.status === "merge_confirm") {
    url.searchParams.set("link", "merge");
    url.searchParams.set("linkToken", result.linkToken);
    return url.toString();
  }
  url.searchParams.set("link", "error");
  url.searchParams.set(
    "linkError",
    result.status === "error" ? result.message : "Не удалось привязать",
  );
  if (result.status === "error" && result.code === "payment_conflict") {
    url.searchParams.set("linkErrorCode", "payment_conflict");
  }
  return url.toString();
}

export async function processTelegramLinkIfNeeded(
  baseUrl: string,
  linkToken: string | undefined,
  profile: TelegramProfile,
): Promise<string | null> {
  if (!linkToken) return null;
  const result = await processProviderLink(linkToken, {
    providerId: AUTH_PROVIDER_IDS.telegram,
    accountId: String(profile.id),
    name: telegramDisplayName(profile),
    email: null,
    image: profile.photoUrl ?? null,
  });
  return cabinetLinkRedirectUrl(baseUrl, result);
}

export async function processVkLinkIfNeeded(
  baseUrl: string,
  linkToken: string | undefined,
  profile: VkSignInProfile,
): Promise<string | null> {
  if (!linkToken) return null;
  const result = await processProviderLink(linkToken, {
    providerId: AUTH_PROVIDER_IDS.vk,
    accountId: profile.accountId,
    name: profile.name,
    email: profile.email,
    image: profile.image,
  });
  return cabinetLinkRedirectUrl(baseUrl, result);
}
