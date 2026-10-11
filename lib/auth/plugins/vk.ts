import {
  APIError,
  createAuthEndpoint,
  formCsrfMiddleware,
} from "better-auth/api";
import {
  type ExternalSignInContext,
  signInWithExternalProfile,
} from "@/lib/auth/external-sign-in";
import { isVkConfigured } from "@/lib/auth/vk/config";
import { createVkAuthorization, exchangeVkCode } from "@/lib/auth/vk/oauth";

function loginUrl(baseUrl: string): URL {
  return new URL("/login", baseUrl);
}

export const vk = () => {
  return {
    id: "vk",
    version: "1.0.0",
    endpoints: {
      startVkOauth: createAuthEndpoint(
        "/vk/oauth/start",
        {
          method: "POST",
          requireHeaders: true,
          use: [formCsrfMiddleware],
        },
        async (ctx) => {
          if (!isVkConfigured()) {
            throw APIError.fromStatus("BAD_REQUEST", {
              message: "VK ID is not configured",
            });
          }
          const body = ctx.body as { next?: string } | undefined;
          const next = typeof body?.next === "string" ? body.next : undefined;
          const started = await createVkAuthorization(
            ctx.context.baseURL,
            next,
          );
          return ctx.json(started);
        },
      ),

      // Better Auth 1.7 rejects OAuth users without email. VK ID may omit it,
      // so this callback creates the session itself (null email, or link by email).
      callbackVk: createAuthEndpoint(
        "/callback/vk",
        {
          method: "GET",
          requireHeaders: true,
        },
        async (ctx) => {
          const baseUrl = ctx.context.baseURL;
          const fail = loginUrl(baseUrl);
          fail.searchParams.set("error", "vk");

          if (!isVkConfigured()) {
            throw ctx.redirect(fail.toString());
          }

          const query = ctx.query as {
            code?: string;
            state?: string;
            device_id?: string;
            error?: string;
          };

          if (query.error || !query.code || !query.state) {
            throw ctx.redirect(fail.toString());
          }

          let profile: Awaited<ReturnType<typeof exchangeVkCode>>["profile"];
          let next: string | undefined;
          try {
            const exchanged = await exchangeVkCode(
              baseUrl,
              query.code,
              query.state,
              query.device_id,
            );
            profile = exchanged.profile;
            next = exchanged.next;
          } catch (error) {
            console.error("[vk oauth] callback failed", error);
            throw ctx.redirect(fail.toString());
          }

          await signInWithExternalProfile(
            ctx as unknown as ExternalSignInContext,
            {
              providerId: "vk",
              accountId: profile.accountId,
              name: profile.name,
              email: profile.email,
              image: profile.image,
            },
          );
          const destination = next?.startsWith("/") ? next : "/cabinet";
          throw ctx.redirect(new URL(destination, baseUrl).toString());
        },
      ),
    },
  };
};
