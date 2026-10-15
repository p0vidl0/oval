"use server";

import { redirect } from "next/navigation";
import { unlinkAuthMethod } from "@/lib/auth/link-account";
import {
  sendEmailLinkOtp,
  verifyEmailLinkOtp,
} from "@/lib/auth/link-email-otp";
import { createAccountLinkIntent } from "@/lib/auth/link-intent";
import {
  listAvailableProvidersToLink,
  listLinkedAuthMethods,
} from "@/lib/auth/linked-accounts";
import {
  confirmProviderLinkMerge,
  processProviderLink,
} from "@/lib/auth/process-provider-link";
import { AUTH_PROVIDER_IDS, type AuthProviderId } from "@/lib/auth/providers";
import { getServerSession } from "@/lib/auth/session";
import { isTelegramBotLoginConfigured } from "@/lib/auth/telegram/config";
import { isTelegramOidcConfigured } from "@/lib/auth/telegram/oidc-config";
import { isVkConfigured } from "@/lib/auth/vk/config";

export type LinkStartResult =
  | { ok: true; linkToken: string; providerId: AuthProviderId }
  | { ok: false; message: string };

async function requireSessionUserId(): Promise<string> {
  const session = await getServerSession();
  if (!session) redirect("/login?next=/cabinet");
  return session.user.id;
}

export async function startAuthMethodLink(
  providerId: AuthProviderId,
): Promise<LinkStartResult> {
  const userId = await requireSessionUserId();
  const linked = await listLinkedAuthMethods(userId);
  const available = listAvailableProvidersToLink(linked);
  if (!available.includes(providerId)) {
    return { ok: false, message: "Этот способ уже подключён" };
  }

  if (providerId === AUTH_PROVIDER_IDS.vk && !isVkConfigured()) {
    return { ok: false, message: "VK ID не настроен" };
  }
  if (providerId === AUTH_PROVIDER_IDS.telegram) {
    if (!isTelegramOidcConfigured() && !isTelegramBotLoginConfigured()) {
      return { ok: false, message: "Telegram не настроен" };
    }
  }

  const { token } = await createAccountLinkIntent({
    targetUserId: userId,
    providerId,
  });
  return { ok: true, linkToken: token, providerId };
}

export async function sendAuthLinkEmailOtp(
  linkToken: string,
  email: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  await requireSessionUserId();
  const sent = await sendEmailLinkOtp(linkToken, email);
  if (!sent.ok) {
    return { ok: false, message: "Введите корректный email" };
  }
  return { ok: true };
}

export async function verifyAuthLinkEmailOtp(
  linkToken: string,
  otp: string,
): Promise<
  | { ok: true; status: "attached" | "merge_confirm" | "already_linked" }
  | { ok: false; message: string }
> {
  await requireSessionUserId();
  const verified = await verifyEmailLinkOtp(linkToken, otp);
  if (!verified.ok) {
    const messages = {
      expired: "Код истёк — запросите новый",
      invalid: "Неверный код",
      too_many: "Слишком много попыток",
    } as const;
    return { ok: false, message: messages[verified.reason] };
  }

  const result = await processProviderLink(linkToken, {
    providerId: AUTH_PROVIDER_IDS.email,
    accountId: verified.email,
    email: verified.email,
  });

  if (result.status === "error") {
    return { ok: false, message: result.message };
  }
  if (result.status === "merge_confirm") {
    return { ok: true, status: "merge_confirm" };
  }
  if (result.status === "already_linked") {
    return { ok: true, status: "already_linked" };
  }
  return { ok: true, status: "attached" };
}

export async function confirmAuthMethodMerge(
  linkToken: string,
): Promise<{ ok: true } | { ok: false; message: string; code?: string }> {
  const userId = await requireSessionUserId();
  const result = await confirmProviderLinkMerge({
    linkToken,
    performedByUserId: userId,
  });
  if (result.status === "error") {
    return { ok: false, message: result.message, code: result.code };
  }
  return { ok: true };
}

export async function unlinkAuthMethodAction(
  providerId: AuthProviderId,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const userId = await requireSessionUserId();
  const result = await unlinkAuthMethod({ userId, providerId });
  if (!result.ok) {
    if (result.reason === "last_method") {
      return {
        ok: false,
        message: "Нельзя отключить последний способ входа",
      };
    }
    return { ok: false, message: "Способ не подключён" };
  }
  return { ok: true };
}
