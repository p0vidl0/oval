import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/lib/auth";
import { createTelegramLoginIntent } from "@/lib/auth/telegram/login-intent";
import { handleTelegramUpdate } from "@/lib/bots/telegram/webhook";
import { db } from "@/lib/db/client";
import { account, user } from "@/lib/db/schema/auth-schema";
import { useIntegrationDb } from "./helpers/setup";

vi.mock("@/lib/bots/telegram/api", () => ({
  sendTelegramMessage: vi.fn().mockResolvedValue(undefined),
}));

const run = process.env.OVAL_INTEGRATION === "1" ? describe : describe.skip;

const BOT_TOKEN = "7000000000:AAIntegrationTestTelegramBotToken";
const BOT_USERNAME = "oval_test_bot";

type TelegramAuthApi = {
  signInTelegramBot: (input: {
    body: { token: string };
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

run("telegram auth", () => {
  useIntegrationDb();

  beforeEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN;
    process.env.TELEGRAM_BOT_USERNAME = BOT_USERNAME;
    process.env.TELEGRAM_OIDC_CLIENT_ID = "7000000000";
    process.env.TELEGRAM_OIDC_CLIENT_SECRET = "integration-oidc-secret";
    process.env.BETTER_AUTH_URL =
      process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  });

  it("bot intent flow creates session after webhook and exchange", async () => {
    const { token } = await createTelegramLoginIntent("/cabinet");

    await handleTelegramUpdate({
      message: {
        message_id: 1,
        chat: { id: 555, type: "private" },
        text: `/start login_${token}`,
        from: {
          id: 900_002,
          first_name: "Bot",
          username: "botuser",
        },
      },
    });

    const api = auth.api as unknown as TelegramAuthApi;
    const exchange = await api.signInTelegramBot({
      body: { token },
      headers: authHeaders(),
    });

    expect(exchange.user.name).toBe("Bot");

    const users = await db
      .select()
      .from(user)
      .where(eq(user.id, exchange.user.id));
    expect(users[0]?.email).toBeNull();

    const accounts = await db
      .select()
      .from(account)
      .where(eq(account.accountId, "900002"));
    expect(accounts[0]?.providerId).toBe("telegram");
  });
});
