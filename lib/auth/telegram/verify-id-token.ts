import { createRemoteJWKSet, type JWTPayload, jwtVerify } from "jose";
import {
  getTelegramOidcClientId,
  getTelegramOidcJwksUrl,
  isTelegramOidcConfigured,
} from "@/lib/auth/telegram/oidc-config";
import type { TelegramProfile } from "@/lib/auth/telegram/types";

const ISSUER = "https://oauth.telegram.org";

let jwksCache: {
  url: string;
  keys: ReturnType<typeof createRemoteJWKSet>;
} | null = null;

function getJwks() {
  const url = getTelegramOidcJwksUrl();
  if (!jwksCache || jwksCache.url !== url) {
    jwksCache = { url, keys: createRemoteJWKSet(new URL(url)) };
  }
  return jwksCache.keys;
}

export type TelegramIdTokenClaims = JWTPayload & {
  /** Telegram user id. Mini App `user.id` is the same value. */
  id?: number | string;
  name?: string;
  given_name?: string;
  family_name?: string;
  preferred_username?: string;
  picture?: string;
};

export type TelegramOidcProfile = TelegramProfile & {
  /**
   * Account id stored by older OIDC logins that used `Number(sub)` instead of `id`.
   * Present only when it differs from the Telegram user id.
   */
  legacyAccountId?: string;
};

/** Positive Telegram user id that fits in a JS safe integer. */
export function parseTelegramUserId(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value <= 0) return null;
    return value;
  }
  if (typeof value === "string" && /^[1-9]\d*$/.test(value)) {
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed)) return null;
    return parsed;
  }
  return null;
}

/**
 * Key written when sign-in fell back to `Number(sub)`.
 * Long subjects lose precision; the stored value is that rounded number.
 */
export function legacyOidcAccountId(
  sub: string | undefined,
  userId: number,
): string | undefined {
  if (!sub) return undefined;
  const asNumber = Number(sub);
  if (!Number.isFinite(asNumber)) return undefined;
  const legacy = String(asNumber);
  if (legacy === String(userId)) return undefined;
  return legacy;
}

export function telegramProfileFromClaims(
  claims: TelegramIdTokenClaims,
): TelegramOidcProfile | null {
  const id = parseTelegramUserId(claims.id);
  if (id === null) return null;

  return {
    id,
    firstName: claims.given_name ?? claims.name?.split(/\s+/)[0],
    lastName: claims.family_name,
    username: claims.preferred_username,
    photoUrl: typeof claims.picture === "string" ? claims.picture : undefined,
    legacyAccountId: legacyOidcAccountId(claims.sub, id),
  };
}

export async function verifyTelegramIdToken(
  idToken: string,
): Promise<TelegramOidcProfile | null> {
  if (!isTelegramOidcConfigured()) return null;
  const clientId = getTelegramOidcClientId();
  if (!clientId) return null;

  try {
    const { payload } = await jwtVerify(idToken, getJwks(), {
      issuer: ISSUER,
      audience: clientId,
    });
    return telegramProfileFromClaims(payload as TelegramIdTokenClaims);
  } catch {
    return null;
  }
}
