import { createRemoteJWKSet, type JWTPayload, jwtVerify } from "jose";
import {
  getTelegramOidcClientId,
  isTelegramOidcConfigured,
} from "@/lib/auth/telegram/oidc-config";
import type { TelegramProfile } from "@/lib/auth/telegram/types";

const JWKS = createRemoteJWKSet(
  new URL("https://oauth.telegram.org/.well-known/jwks.json"),
);

export type TelegramIdTokenClaims = JWTPayload & {
  id?: number;
  name?: string;
  given_name?: string;
  family_name?: string;
  preferred_username?: string;
  picture?: string;
};

export function telegramProfileFromClaims(
  claims: TelegramIdTokenClaims,
): TelegramProfile | null {
  const id =
    typeof claims.id === "number"
      ? claims.id
      : claims.sub
        ? Number(claims.sub)
        : Number.NaN;
  if (!Number.isFinite(id)) return null;

  return {
    id,
    firstName: claims.given_name ?? claims.name?.split(/\s+/)[0],
    lastName: claims.family_name,
    username: claims.preferred_username,
    photoUrl: typeof claims.picture === "string" ? claims.picture : undefined,
  };
}

export async function verifyTelegramIdToken(
  idToken: string,
): Promise<TelegramProfile | null> {
  if (!isTelegramOidcConfigured()) return null;
  const clientId = getTelegramOidcClientId();
  if (!clientId) return null;

  try {
    const { payload } = await jwtVerify(idToken, JWKS, {
      issuer: "https://oauth.telegram.org",
      audience: clientId,
    });
    return telegramProfileFromClaims(payload as TelegramIdTokenClaims);
  } catch {
    return null;
  }
}
