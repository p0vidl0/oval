import { and, eq } from "drizzle-orm";
import { AUTH_PROVIDER_IDS } from "@/lib/auth/providers";
import type { TelegramOidcProfile } from "@/lib/auth/telegram/verify-id-token";
import { db } from "@/lib/db/client";
import { account } from "@/lib/db/schema/auth-schema";

export type LegacyAdoptDecision =
  | { action: "skip" }
  | { action: "rebind"; rowId: string };

/** Rebind the single `Number(sub)` row only while the real Telegram id is free. */
export function decideLegacyTelegramAdopt(input: {
  canonicalAccountId: string;
  legacyAccountId?: string;
  canonicalTaken: boolean;
  legacyRowIds: string[];
}): LegacyAdoptDecision {
  if (
    !input.legacyAccountId ||
    input.legacyAccountId === input.canonicalAccountId ||
    input.canonicalTaken ||
    input.legacyRowIds.length !== 1
  ) {
    return { action: "skip" };
  }
  return { action: "rebind", rowId: input.legacyRowIds[0] };
}

function isUniqueViolation(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    if ("code" in current && current.code === "23505") return true;
    current = "cause" in current ? current.cause : undefined;
  }
  return false;
}

/**
 * Point an old OIDC account (`Number(sub)`) at the Telegram user id.
 * If that id is already taken, leave the old row in place.
 */
export async function adoptLegacyTelegramOidcAccount(
  profile: TelegramOidcProfile,
): Promise<void> {
  const canonicalAccountId = String(profile.id);
  const legacyAccountId = profile.legacyAccountId;
  if (!legacyAccountId || legacyAccountId === canonicalAccountId) return;

  const providerId = AUTH_PROVIDER_IDS.telegram;
  const [canonical] = await db
    .select({ id: account.id })
    .from(account)
    .where(
      and(
        eq(account.providerId, providerId),
        eq(account.accountId, canonicalAccountId),
      ),
    )
    .limit(1);

  const legacyRows = canonical
    ? []
    : await db
        .select({ id: account.id })
        .from(account)
        .where(
          and(
            eq(account.providerId, providerId),
            eq(account.accountId, legacyAccountId),
          ),
        )
        .limit(2);

  const decision = decideLegacyTelegramAdopt({
    canonicalAccountId,
    legacyAccountId,
    canonicalTaken: Boolean(canonical),
    legacyRowIds: legacyRows.map((row) => row.id),
  });
  if (decision.action === "skip") return;

  try {
    await db
      .update(account)
      .set({ accountId: canonicalAccountId })
      .where(
        and(
          eq(account.id, decision.rowId),
          eq(account.providerId, providerId),
          eq(account.accountId, legacyAccountId),
        ),
      );
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }
}
