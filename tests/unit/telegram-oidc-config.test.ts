import { afterEach, describe, expect, it } from "vitest";
import {
  getTelegramOidcJwksUrl,
  getTelegramOidcRedirectUri,
  getTelegramOidcRoot,
  getTelegramOidcTokenUrl,
} from "@/lib/auth/telegram/oidc-config";

describe("Telegram OIDC root", () => {
  afterEach(() => {
    delete process.env.TELEGRAM_OIDC_ROOT;
  });

  it("defaults to oauth.telegram.org", () => {
    expect(getTelegramOidcRoot()).toBe("https://oauth.telegram.org");
    expect(getTelegramOidcTokenUrl()).toBe("https://oauth.telegram.org/token");
    expect(getTelegramOidcJwksUrl()).toBe(
      "https://oauth.telegram.org/.well-known/jwks.json",
    );
  });

  it("uses TELEGRAM_OIDC_ROOT without trailing slash", () => {
    process.env.TELEGRAM_OIDC_ROOT = "https://tg-proxy.example.com/";
    expect(getTelegramOidcRoot()).toBe("https://tg-proxy.example.com");
    expect(getTelegramOidcTokenUrl()).toBe(
      "https://tg-proxy.example.com/token",
    );
    expect(getTelegramOidcJwksUrl()).toBe(
      "https://tg-proxy.example.com/.well-known/jwks.json",
    );
  });
});

describe("getTelegramOidcRedirectUri", () => {
  it("appends callback path to Better Auth baseURL", () => {
    expect(
      getTelegramOidcRedirectUri(
        "https://backwash-helpline-traverse.ngrok-free.dev/api/auth",
      ),
    ).toBe(
      "https://backwash-helpline-traverse.ngrok-free.dev/api/auth/sign-in/telegram/oidc/callback",
    );
  });

  it("adds /api/auth when given site origin only", () => {
    expect(getTelegramOidcRedirectUri("https://example.com")).toBe(
      "https://example.com/api/auth/sign-in/telegram/oidc/callback",
    );
  });
});
