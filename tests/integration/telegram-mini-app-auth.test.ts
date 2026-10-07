import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { auth } from "@/lib/auth";
import { signTelegramInitDataForTest } from "@/lib/auth/telegram/verify-init-data";
import { db } from "@/lib/db/client";
import { account } from "@/lib/db/schema/auth-schema";
import { useIntegrationDb } from "./helpers/setup";

const run = process.env.OVAL_INTEGRATION === "1" ? describe : describe.skip;

const BOT_TOKEN = "7000000000:AAIntegrationTestTelegramBotToken";

type TelegramMiniAppAuthApi = {
  signInTelegramMiniApp: (input: {
    body: { initData: string };
    headers: Headers;
  }) => Promise<{ user: { name: string; id: string }; token: string }>;
};

function authHeaders(): Headers {
  const origin = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  return new Headers({
    origin,
    "content-type": "application/json",
  });
}

run("telegram mini app auth", () => {
  useIntegrationDb();

  beforeEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN;
    process.env.TELEGRAM_BOT_USERNAME = "oval_test_bot";
    process.env.BETTER_AUTH_URL =
      process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  });

  it("signs in with valid initData", async () => {
    const initData = signTelegramInitDataForTest(
      {
        auth_date: String(Math.floor(Date.now() / 1000)),
        user: JSON.stringify({
          id: 900_003,
          first_name: "Mini",
          username: "miniuser",
        }),
      },
      BOT_TOKEN,
    );

    const api = auth.api as unknown as TelegramMiniAppAuthApi;
    const result = await api.signInTelegramMiniApp({
      body: { initData },
      headers: authHeaders(),
    });

    expect(result.user.name).toBe("Mini");

    const accounts = await db
      .select()
      .from(account)
      .where(eq(account.accountId, "900003"));
    expect(accounts[0]?.providerId).toBe("telegram");
  });
});
