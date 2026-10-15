import {
  APIError,
  createAuthEndpoint,
  formCsrfMiddleware,
} from "better-auth/api";
import { processTelegramLinkIfNeeded } from "@/lib/auth/link-callback";
import { adoptLegacyTelegramOidcAccount } from "@/lib/auth/telegram/adopt-legacy-account";
import {
  isTelegramBotLoginConfigured,
  isTelegramMiniAppConfigured,
} from "@/lib/auth/telegram/config";
import {
  consumeTelegramLoginIntent,
  createTelegramLoginIntent,
} from "@/lib/auth/telegram/login-intent";
import { isTelegramOidcConfigured } from "@/lib/auth/telegram/oidc-config";
import {
  createTelegramOidcAuthorization,
  exchangeTelegramOidcCode,
} from "@/lib/auth/telegram/oidc-pkce";
import {
  signInWithTelegramProfile,
  type TelegramSignInContext,
} from "@/lib/auth/telegram/sign-in";
import { verifyTelegramIdToken } from "@/lib/auth/telegram/verify-id-token";
import { verifyTelegramInitData } from "@/lib/auth/telegram/verify-init-data";
import { safeInternalPath } from "@/lib/site/safe-internal-path";

export const telegram = () => {
  return {
    id: "telegram",
    version: "1.0.0",
    endpoints: {
      startTelegramOidc: createAuthEndpoint(
        "/telegram/oidc/start",
        {
          method: "POST",
          requireHeaders: true,
          use: [formCsrfMiddleware],
        },
        async (ctx) => {
          if (!isTelegramOidcConfigured()) {
            throw APIError.fromStatus("BAD_REQUEST", {
              message: "Telegram OIDC is not configured",
            });
          }
          const body = ctx.body as
            | { next?: string; linkToken?: string }
            | undefined;
          const next = typeof body?.next === "string" ? body.next : undefined;
          const linkToken =
            typeof body?.linkToken === "string" ? body.linkToken : undefined;
          const baseUrl = ctx.context.baseURL;
          const started = await createTelegramOidcAuthorization(
            baseUrl,
            next,
            linkToken,
          );
          return ctx.json(started);
        },
      ),

      signInTelegramOidc: createAuthEndpoint(
        "/sign-in/telegram/oidc",
        {
          method: "POST",
          requireHeaders: true,
          use: [formCsrfMiddleware],
        },
        async (ctx) => {
          if (!isTelegramOidcConfigured()) {
            throw APIError.fromStatus("BAD_REQUEST", {
              message: "Telegram OIDC is not configured",
            });
          }
          const body = ctx.body as { id_token?: string } | undefined;
          const idToken = body?.id_token;
          if (!idToken || idToken.length < 20) {
            throw APIError.fromStatus("BAD_REQUEST", {
              message: "Invalid id_token",
            });
          }

          const profile = await verifyTelegramIdToken(idToken);
          if (!profile) {
            throw APIError.fromStatus("UNAUTHORIZED", {
              message: "Invalid Telegram id_token",
            });
          }

          await adoptLegacyTelegramOidcAccount(profile);

          return ctx.json(
            await signInWithTelegramProfile(
              ctx as unknown as TelegramSignInContext,
              profile,
            ),
          );
        },
      ),

      callbackTelegramOidc: createAuthEndpoint(
        "/sign-in/telegram/oidc/callback",
        {
          method: "GET",
          requireHeaders: true,
        },
        async (ctx) => {
          if (!isTelegramOidcConfigured()) {
            throw APIError.fromStatus("BAD_REQUEST", {
              message: "Telegram OIDC is not configured",
            });
          }

          const query = ctx.query as {
            code?: string;
            state?: string;
            error?: string;
          };

          if (query.error) {
            const login = new URL("/login", ctx.context.baseURL);
            login.searchParams.set("error", "telegram_oidc");
            throw ctx.redirect(login.toString());
          }

          const code = query.code;
          const state = query.state;
          if (!code || !state) {
            throw APIError.fromStatus("BAD_REQUEST", {
              message: "Missing code or state",
            });
          }

          const { profile, next, linkToken } = await exchangeTelegramOidcCode(
            ctx.context.baseURL,
            code,
            state,
          );
          if (!profile) {
            throw APIError.fromStatus("UNAUTHORIZED", {
              message: "Invalid Telegram profile",
            });
          }

          await adoptLegacyTelegramOidcAccount(profile);

          const linkRedirect = await processTelegramLinkIfNeeded(
            ctx.context.baseURL,
            linkToken,
            profile,
          );
          if (linkRedirect) {
            throw ctx.redirect(linkRedirect);
          }

          await signInWithTelegramProfile(
            ctx as unknown as TelegramSignInContext,
            profile,
          );

          const destination = safeInternalPath(next);
          throw ctx.redirect(
            new URL(destination, ctx.context.baseURL).toString(),
          );
        },
      ),

      createTelegramLoginIntent: createAuthEndpoint(
        "/telegram/login-intent",
        {
          method: "POST",
          requireHeaders: true,
          use: [formCsrfMiddleware],
        },
        async (ctx) => {
          if (!isTelegramBotLoginConfigured()) {
            throw APIError.fromStatus("BAD_REQUEST", {
              message: "Telegram bot login is not configured",
            });
          }
          const body = ctx.body as
            | { next?: string; linkToken?: string }
            | undefined;
          const next = typeof body?.next === "string" ? body.next : undefined;
          const linkToken =
            typeof body?.linkToken === "string" ? body.linkToken : undefined;
          const intent = await createTelegramLoginIntent(next, linkToken);
          return ctx.json(intent);
        },
      ),

      signInTelegramMiniApp: createAuthEndpoint(
        "/sign-in/telegram/mini-app",
        {
          method: "POST",
          requireHeaders: true,
          use: [formCsrfMiddleware],
        },
        async (ctx) => {
          if (!isTelegramMiniAppConfigured()) {
            throw APIError.fromStatus("BAD_REQUEST", {
              message: "Telegram Mini App is not configured",
            });
          }

          const body = ctx.body as { initData?: string } | undefined;
          const initData = body?.initData;
          if (!initData || initData.length < 10) {
            throw APIError.fromStatus("BAD_REQUEST", {
              message: "Invalid initData",
            });
          }

          const verified = verifyTelegramInitData(initData);
          if (!verified) {
            throw APIError.fromStatus("UNAUTHORIZED", {
              message: "Invalid Telegram initData",
            });
          }

          return ctx.json(
            await signInWithTelegramProfile(
              ctx as unknown as TelegramSignInContext,
              verified.profile,
            ),
          );
        },
      ),

      signInTelegramBot: createAuthEndpoint(
        "/sign-in/telegram/bot",
        {
          method: "POST",
          requireHeaders: true,
          use: [formCsrfMiddleware],
        },
        async (ctx) => {
          if (!isTelegramBotLoginConfigured()) {
            throw APIError.fromStatus("BAD_REQUEST", {
              message: "Telegram bot login is not configured",
            });
          }

          const body = ctx.body as { token?: string } | undefined;
          const token = body?.token;
          if (!token || token.length < 8) {
            throw APIError.fromStatus("BAD_REQUEST", {
              message: "Invalid login token",
            });
          }

          const record = await consumeTelegramLoginIntent(token);
          if (!record?.telegramId) {
            throw APIError.fromStatus("UNAUTHORIZED", {
              message: "Login link expired or not confirmed in Telegram",
            });
          }

          const profile = {
            id: Number(record.telegramId),
            firstName: record.firstName,
            lastName: record.lastName,
            username: record.username,
            photoUrl: record.photoUrl,
          };

          if (!Number.isFinite(profile.id)) {
            throw APIError.fromStatus("UNAUTHORIZED", {
              message: "Invalid login session",
            });
          }

          if (record.linkToken) {
            const redirect = await processTelegramLinkIfNeeded(
              ctx.context.baseURL,
              record.linkToken,
              profile,
            );
            if (redirect) {
              return ctx.json({ redirect });
            }
          }

          return ctx.json(
            await signInWithTelegramProfile(
              ctx as unknown as TelegramSignInContext,
              profile,
            ),
          );
        },
      ),
    },
  };
};
