import { describe, expect, it } from "vitest";
import { getTelegramOidcRedirectUri } from "@/lib/auth/telegram/oidc-config";

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
