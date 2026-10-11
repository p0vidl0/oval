import { APIError } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { parseUserOutput } from "better-auth/db";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { user as userTable } from "@/lib/db/schema/auth-schema";

/** Minimal Better Auth endpoint ctx used for messenger / VK sign-in. */
export type ExternalSignInContext = {
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

export type ExternalSignInProfile = {
  providerId: string;
  accountId: string;
  name: string;
  email: string | null;
  image?: string | null;
};

export async function signInWithExternalProfile(
  ctx: ExternalSignInContext,
  profile: ExternalSignInProfile,
) {
  const existing = await ctx.context.internalAdapter.findAccountByKey({
    providerId: profile.providerId,
    accountId: profile.accountId,
  });

  let user =
    existing &&
    (await ctx.context.internalAdapter.findUserById(existing.userId));

  if (!user && profile.email) {
    const [row] = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.email, profile.email))
      .limit(1);
    if (row) {
      user = await ctx.context.internalAdapter.findUserById(row.id);
    }
    if (user) {
      await ctx.context.internalAdapter.createAccount({
        userId: user.id,
        providerId: profile.providerId,
        accountId: profile.accountId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  if (!user) {
    user = await ctx.context.internalAdapter.createUser(
      {
        name: profile.name,
        email: profile.email,
        emailVerified: Boolean(profile.email),
        image: profile.image ?? undefined,
      },
      { method: profile.providerId },
    );
    if (!user) {
      throw APIError.fromStatus("INTERNAL_SERVER_ERROR", {
        message: "Failed to create user",
      });
    }
    await ctx.context.internalAdapter.createAccount({
      userId: user.id,
      providerId: profile.providerId,
      accountId: profile.accountId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } else if (profile.image && !user.image) {
    user = await ctx.context.internalAdapter.updateUser(user.id, {
      image: profile.image,
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
