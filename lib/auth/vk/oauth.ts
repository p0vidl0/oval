import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  getVkClientId,
  getVkClientSecret,
  getVkRedirectUri,
  isVkConfigured,
} from "@/lib/auth/vk/config";
import {
  type VkProfileUser,
  vkAccountId,
  vkDisplayName,
  vkEmail,
} from "@/lib/auth/vk/profile";
import { db } from "@/lib/db/client";
import { verification } from "@/lib/db/schema/auth-schema";
import { optionalSafeInternalPath } from "@/lib/site/safe-internal-path";

const STATE_PREFIX = "vk-oauth:";
const TTL_MS = 10 * 60 * 1000;
const AUTHORIZE_URL = "https://id.vk.com/authorize";
const TOKEN_URL = "https://id.vk.com/oauth2/auth";
const USER_INFO_URL = "https://id.vk.com/oauth2/user_info";

export type VkSignInProfile = {
  accountId: string;
  name: string;
  email: string | null;
  image: string | null;
};

type PendingOauth = {
  codeVerifier: string;
  next?: string;
  linkToken?: string;
};

function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

function parsePending(raw: string): PendingOauth | null {
  try {
    const parsed = JSON.parse(raw) as PendingOauth;
    if (typeof parsed.codeVerifier !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function buildVkAuthorizationUrl(
  baseUrl: string,
  state: string,
  codeChallenge: string,
): string {
  const clientId = getVkClientId();
  if (!clientId) throw new Error("VK_CLIENT_ID not configured");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: getVkRedirectUri(baseUrl),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    scope: "email",
  });

  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export async function createVkAuthorization(
  baseUrl: string,
  next?: string,
  linkToken?: string,
): Promise<{ authorizationUrl: string; state: string }> {
  if (!isVkConfigured()) {
    throw new Error("VK ID is not configured");
  }

  const state = randomBytes(24).toString("base64url");
  const codeVerifier = randomBytes(32).toString("base64url");
  const value: PendingOauth = {
    codeVerifier,
    next: optionalSafeInternalPath(next),
    linkToken: linkToken?.trim() || undefined,
  };

  await db.insert(verification).values({
    id: crypto.randomUUID(),
    identifier: `${STATE_PREFIX}${state}`,
    value: JSON.stringify(value),
    expiresAt: new Date(Date.now() + TTL_MS),
  });

  return {
    state,
    authorizationUrl: buildVkAuthorizationUrl(
      baseUrl,
      state,
      pkceChallenge(codeVerifier),
    ),
  };
}

async function consumeState(state: string): Promise<PendingOauth> {
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
  return pending;
}

function profileFromUserInfo(user: VkProfileUser): VkSignInProfile {
  const accountId = vkAccountId(user);
  if (!accountId) throw new Error("VK user info missing user_id");
  return {
    accountId,
    name: vkDisplayName(user, accountId),
    email: vkEmail(user.email),
    image: user.avatar?.trim() || null,
  };
}

export async function exchangeVkCode(
  baseUrl: string,
  code: string,
  state: string,
  deviceId?: string,
): Promise<{ profile: VkSignInProfile; next?: string; linkToken?: string }> {
  const pending = await consumeState(state);
  const clientId = getVkClientId();
  const clientSecret = getVkClientSecret();
  if (!clientId || !clientSecret) throw new Error("VK ID is not configured");

  const tokenBody = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    code_verifier: pending.codeVerifier,
    redirect_uri: getVkRedirectUri(baseUrl),
    client_id: clientId,
    client_secret: clientSecret,
  });
  if (deviceId) tokenBody.set("device_id", deviceId);

  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenBody,
  });
  if (!tokenRes.ok) {
    throw new Error(`VK token exchange failed: ${tokenRes.status}`);
  }

  const tokens = (await tokenRes.json()) as { access_token?: string };
  if (!tokens.access_token) {
    throw new Error("VK token response missing access_token");
  }

  const infoBody = new URLSearchParams({
    access_token: tokens.access_token,
    client_id: clientId,
  });
  const infoRes = await fetch(USER_INFO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: infoBody,
  });
  if (!infoRes.ok) {
    throw new Error(`VK user info failed: ${infoRes.status}`);
  }

  const info = (await infoRes.json()) as { user?: VkProfileUser };
  if (!info.user) throw new Error("VK user info missing user");

  return {
    profile: profileFromUserInfo(info.user),
    next: pending.next,
    linkToken: pending.linkToken,
  };
}
