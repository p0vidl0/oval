import { eq } from "drizzle-orm";
import {
  AUTH_PROVIDER_IDS,
  type AuthProviderId,
  LINKABLE_PROVIDERS,
} from "@/lib/auth/providers";
import { db } from "@/lib/db/client";
import { account, user } from "@/lib/db/schema/auth-schema";

export type LinkedAuthMethod = {
  providerId: AuthProviderId;
  /** Human-readable detail (email, Telegram id, …). */
  detail: string | null;
  accountRowId?: string;
};

export async function listLinkedAuthMethods(
  userId: string,
): Promise<LinkedAuthMethod[]> {
  const [profile] = await db
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  const accounts = await db
    .select({
      id: account.id,
      providerId: account.providerId,
      accountId: account.accountId,
    })
    .from(account)
    .where(eq(account.userId, userId));

  const methods: LinkedAuthMethod[] = [];

  if (profile?.email?.trim()) {
    methods.push({
      providerId: AUTH_PROVIDER_IDS.email,
      detail: profile.email.trim(),
    });
  }

  for (const providerId of [AUTH_PROVIDER_IDS.telegram, AUTH_PROVIDER_IDS.vk]) {
    const row = accounts.find((a) => a.providerId === providerId);
    if (row) {
      methods.push({
        providerId,
        detail: row.accountId,
        accountRowId: row.id,
      });
    }
  }

  return methods;
}

export function listAvailableProvidersToLink(
  linked: LinkedAuthMethod[],
): AuthProviderId[] {
  const used = new Set(linked.map((m) => m.providerId));
  return LINKABLE_PROVIDERS.filter((p) => !used.has(p));
}

export async function countAuthMethods(userId: string): Promise<number> {
  const linked = await listLinkedAuthMethods(userId);
  return linked.length;
}
