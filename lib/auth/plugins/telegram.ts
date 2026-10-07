import {
  APIError,
  createAuthEndpoint,
  formCsrfMiddleware,
} from "better-auth/api";
import { isTelegramBotLoginConfigured } from "@/lib/auth/telegram/config";
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
          const body = ctx.body as { next?: string } | undefined;
          const next = typeof body?.next === "string" ? body.next : undefined;
          const baseUrl = ctx.context.baseURL;
          const started = await createTelegramOidcAuthorization(baseUrl, next);
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

          const { profile, next } = await exchangeTelegramOidcCode(
            ctx.context.baseURL,
            code,
            state,
          );
          if (!profile) {
            throw APIError.fromStatus("UNAUTHORIZED", {
              message: "Invalid Telegram profile",
            });
          }

          await signInWithTelegramProfile(
            ctx as unknown as TelegramSignInContext,
            profile,
          );

          const destination = next?.startsWith("/") ? next : "/cabinet";
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
          const body = ctx.body as { next?: string } | undefined;
          const next = typeof body?.next === "string" ? body.next : undefined;
          const intent = await createTelegramLoginIntent(next);
          return ctx.json(intent);
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
