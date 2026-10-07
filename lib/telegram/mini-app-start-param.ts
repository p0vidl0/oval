import {
  getTelegramBotUsername,
  getTelegramMiniAppShortName,
} from "@/lib/auth/telegram/config";

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export type TelegramMiniAppStartRoute =
  | { kind: "post"; postId: string; path: `/feed/${string}` }
  | {
      kind: "pay";
      registrationId: string;
      path: `/cabinet/pay/${string}`;
    };

export function buildMiniAppStartParamPost(postId: string): string {
  return `p_${postId}`;
}

export function buildMiniAppStartParamPay(registrationId: string): string {
  return `pay_${registrationId}`;
}

export function resolveStartParamRoute(
  startParam: string | undefined | null,
): TelegramMiniAppStartRoute | null {
  if (!startParam?.trim()) return null;
  const param = startParam.trim();

  if (param.startsWith("login_")) return null;

  const postMatch = param.match(/^p_(.+)$/);
  if (postMatch?.[1] && ID_PATTERN.test(postMatch[1])) {
    const postId = postMatch[1];
    return { kind: "post", postId, path: `/feed/${postId}` };
  }

  const payMatch = param.match(/^pay_(.+)$/);
  if (payMatch?.[1] && ID_PATTERN.test(payMatch[1])) {
    const registrationId = payMatch[1];
    return {
      kind: "pay",
      registrationId,
      path: `/cabinet/pay/${registrationId}`,
    };
  }

  return null;
}

/** Direct Mini App link: https://t.me/{bot}/{shortName}?startapp=... */
export function buildTelegramMiniAppLink(startParam: string): string | null {
  const username = getTelegramBotUsername();
  const shortName = getTelegramMiniAppShortName();
  if (!username || !shortName) return null;
  return `https://t.me/${username}/${shortName}?startapp=${encodeURIComponent(startParam)}`;
}
