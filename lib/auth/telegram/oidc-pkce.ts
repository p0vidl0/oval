import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  getTelegramOidcClientId,
  getTelegramOidcClientSecret,
  getTelegramOidcRedirectUri,
  isTelegramOidcConfigured,
} from "@/lib/auth/telegram/oidc-config";
import { verifyTelegramIdToken } from "@/lib/auth/telegram/verify-id-token";
import { db } from "@/lib/db/client";
import { verification } from "@/lib/db/schema/auth-schema";

const STATE_PREFIX = "telegram-oidc:";
const TTL_MS = 10 * 60 * 1000;

function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

type PendingOidc = {
  codeVerifier: string;
  next?: string;
};

function parsePending(raw: string): PendingOidc | null {
  try {
    const parsed = JSON.parse(raw) as PendingOidc;
    if (typeof parsed.codeVerifier !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function buildTelegramOidcAuthorizationUrl(
  baseUrl: string,
  state: string,
  codeChallenge: string,
): string {
  const clientId = getTelegramOidcClientId();
  if (!clientId) throw new Error("TELEGRAM_OIDC_CLIENT_ID not configured");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getTelegramOidcRedirectUri(baseUrl),
    response_type: "code",
    scope: "openid profile",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return `https://oauth.telegram.org/auth?${params.toString()}`;
}

export async function createTelegramOidcAuthorization(
  baseUrl: string,
  next?: string,
): Promise<{ authorizationUrl: string; state: string }> {
  if (!isTelegramOidcConfigured()) {
    throw new Error("Telegram OIDC is not configured");
  }

  const state = randomBytes(24).toString("base64url");
  const codeVerifier = randomBytes(32).toString("base64url");
  const identifier = `${STATE_PREFIX}${state}`;
  const value: PendingOidc = {
    codeVerifier,
    next: next?.startsWith("/") ? next : undefined,
  };

  await db.insert(verification).values({
    id: crypto.randomUUID(),
    identifier,
    value: JSON.stringify(value),
    expiresAt: new Date(Date.now() + TTL_MS),
  });

  return {
    state,
    authorizationUrl: buildTelegramOidcAuthorizationUrl(
      baseUrl,
      state,
      pkceChallenge(codeVerifier),
    ),
  };
}

export async function exchangeTelegramOidcCode(
  baseUrl: string,
  code: string,
  state: string,
): Promise<{
  profile: Awaited<ReturnType<typeof verifyTelegramIdToken>>;
  next?: string;
}> {
  const identifier = `${STATE_PREFIX}${state}`;
  const rows = await db
    .select()
    .from(verification)
    .where(eq(verification.identifier, identifier))
    .limit(1);
  const row = rows[0];
  if (!row || row.expiresAt <= new Date()) {
    if (row) await db.delete(verification).where(eq(verification.id, row.id));
    throw new Error("Invalid or expired OAuth state");
  }

  const pending = parsePending(row.value);
  await db.delete(verification).where(eq(verification.id, row.id));
  if (!pending) throw new Error("Invalid OAuth state");

  const clientId = getTelegramOidcClientId();
  const clientSecret = getTelegramOidcClientSecret();
  if (!clientId || !clientSecret)
    throw new Error("Telegram OIDC not configured");

  const redirectUri = getTelegramOidcRedirectUri(baseUrl);
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: pending.codeVerifier,
  });

  const tokenRes = await fetch("https://oauth.telegram.org/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body,
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new Error(
      `Telegram token exchange failed: ${tokenRes.status} ${text}`,
    );
  }

  const tokens = (await tokenRes.json()) as { id_token?: string };
  if (!tokens.id_token)
    throw new Error("Telegram token response missing id_token");

  const profile = await verifyTelegramIdToken(tokens.id_token);
  if (!profile) throw new Error("Invalid Telegram id_token");

  return { profile, next: pending.next };
}
