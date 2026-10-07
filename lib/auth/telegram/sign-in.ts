import { APIError } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { parseUserOutput } from "better-auth/db";
import { telegramDisplayName } from "@/lib/auth/telegram/display-name";
import type { TelegramProfile } from "@/lib/auth/telegram/types";

/** Minimal Better Auth endpoint ctx used for Telegram sign-in. */
export type TelegramSignInContext = {
  context: {
    internalAdapter: {
      findAccountByKey: (key: {
        providerId: string;
        accountId: string;
      }) => Promise<{ userId: string } | null>;
      findUserById: (userId: string) => Promise<AppUser | null>;
      createUser: (
        user: Partial<AppUser> & { name: string },
        source: { method: string },
      ) => Promise<AppUser | null>;
      createAccount: (account: Record<string, unknown>) => Promise<unknown>;
      createSession: (userId: string) => Promise<AppSession | null>;
      updateUser: (userId: string, data: Partial<AppUser>) => Promise<AppUser>;
    };
    options: Parameters<typeof parseUserOutput>[0];
  };
  json: (data: unknown) => unknown;
};

type AppUser = {
  id: string;
  name: string;
  email: string | null;
  emailVerified: boolean;
  image?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type AppSession = {
  id: string;
  token: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export async function signInWithTelegramProfile(
  ctx: TelegramSignInContext,
  profile: TelegramProfile,
) {
  const accountId = String(profile.id);
  const existing = await ctx.context.internalAdapter.findAccountByKey({
    providerId: "telegram",
    accountId,
  });

  let user =
    existing &&
    (await ctx.context.internalAdapter.findUserById(existing.userId));

  if (!user) {
    user = await ctx.context.internalAdapter.createUser(
      {
        name: telegramDisplayName(profile),
        email: null,
        emailVerified: false,
        image: profile.photoUrl ?? undefined,
      },
      { method: "telegram" },
    );
    if (!user) {
      throw APIError.fromStatus("INTERNAL_SERVER_ERROR", {
        message: "Failed to create user",
      });
    }
    await ctx.context.internalAdapter.createAccount({
      userId: user.id,
      providerId: "telegram",
      accountId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } else if (profile.photoUrl && !user.image) {
    user = await ctx.context.internalAdapter.updateUser(user.id, {
      image: profile.photoUrl,
    });
  }

  const session = await ctx.context.internalAdapter.createSession(user.id);
  if (!session) {
    throw APIError.fromStatus("INTERNAL_SERVER_ERROR", {
      message: "Failed to create session",
    });
  }

  await setSessionCookie(ctx as Parameters<typeof setSessionCookie>[0], {
    session,
    user: user as Parameters<typeof setSessionCookie>[1]["user"],
  });

  return {
    token: session.token,
    user: parseUserOutput(
      ctx.context.options,
      user as Parameters<typeof parseUserOutput>[1],
    ),
  };
}
