import {
  attachEmailToUser,
  resolveAttachAccount,
} from "@/lib/auth/link-account";
import {
  consumeAccountLinkIntent,
  getAccountLinkIntent,
  updateAccountLinkIntent,
} from "@/lib/auth/link-intent";
import { MergeUsersError, mergeUsers } from "@/lib/auth/merge-users";
import type { AuthProviderId } from "@/lib/auth/providers";

export type ProviderLinkProfile = {
  providerId: AuthProviderId;
  accountId: string;
  name?: string;
  email?: string | null;
  image?: string | null;
};

export type ProcessProviderLinkResult =
  | { status: "attached" }
  | { status: "already_linked" }
  | {
      status: "merge_confirm";
      linkToken: string;
      sourceUserId: string;
      sourceName: string;
    }
  | { status: "merged" }
  | { status: "error"; message: string; code?: string };

export async function processProviderLink(
  linkToken: string,
  profile: ProviderLinkProfile,
): Promise<ProcessProviderLinkResult> {
  const intent = await getAccountLinkIntent(linkToken);
  if (!intent || intent.providerId !== profile.providerId) {
    return { status: "error", message: "Ссылка привязки истекла" };
  }

  const targetUserId = intent.targetUserId;

  if (profile.providerId === "email") {
    const email = profile.email ?? profile.accountId;
    const result = await attachEmailToUser(targetUserId, email);
    if (result.action === "already_linked") {
      await consumeAccountLinkIntent(linkToken);
      return { status: "already_linked" };
    }
    if (result.action === "merge_required") {
      await updateAccountLinkIntent(linkToken, {
        status: "awaiting_merge_confirm",
        sourceUserId: result.sourceUserId,
        externalAccountId: email,
        externalProfile: { email, name: profile.name, image: profile.image },
      });
      return {
        status: "merge_confirm",
        linkToken,
        sourceUserId: result.sourceUserId,
        sourceName: result.sourceName,
      };
    }
    await consumeAccountLinkIntent(linkToken);
    return { status: "attached" };
  }

  const result = await resolveAttachAccount({
    targetUserId,
    providerId: profile.providerId,
    accountId: profile.accountId,
    email: profile.email,
    image: profile.image,
    name: profile.name,
  });

  if (result.action === "already_linked") {
    await consumeAccountLinkIntent(linkToken);
    return { status: "already_linked" };
  }

  if (result.action === "merge_required") {
    await updateAccountLinkIntent(linkToken, {
      status: "awaiting_merge_confirm",
      sourceUserId: result.sourceUserId,
      externalAccountId: profile.accountId,
      externalProfile: {
        email: profile.email,
        name: profile.name,
        image: profile.image,
      },
    });
    return {
      status: "merge_confirm",
      linkToken,
      sourceUserId: result.sourceUserId,
      sourceName: result.sourceName,
    };
  }

  await consumeAccountLinkIntent(linkToken);
  return { status: "attached" };
}

export async function confirmProviderLinkMerge(input: {
  linkToken: string;
  performedByUserId: string;
}): Promise<ProcessProviderLinkResult> {
  const intent = await getAccountLinkIntent(input.linkToken);
  if (
    !intent ||
    intent.status !== "awaiting_merge_confirm" ||
    !intent.sourceUserId
  ) {
    return { status: "error", message: "Подтверждение недоступно" };
  }
  if (intent.targetUserId !== input.performedByUserId) {
    return { status: "error", message: "Недостаточно прав" };
  }

  try {
    await mergeUsers({
      sourceUserId: intent.sourceUserId,
      targetUserId: intent.targetUserId,
      performedByUserId: input.performedByUserId,
      kind: "self_link",
      selfService: true,
    });
  } catch (error) {
    if (error instanceof MergeUsersError) {
      return {
        status: "error",
        message: error.message,
        code: error.code,
      };
    }
    throw error;
  }

  await consumeAccountLinkIntent(input.linkToken);
  return { status: "merged" };
}
