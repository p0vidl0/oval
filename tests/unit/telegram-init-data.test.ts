import { describe, expect, it } from "vitest";
import { parseTelegramInitDataUserJson } from "@/lib/auth/telegram/profile-from-init-data";
import {
  signTelegramInitDataForTest,
  verifyTelegramInitData,
} from "@/lib/auth/telegram/verify-init-data";

const BOT_TOKEN = "7000000000:AAUnitTestTelegramBotToken";

function validInitData(overrides?: Record<string, string>): string {
  const authDate = String(Math.floor(Date.now() / 1000));
  return signTelegramInitDataForTest(
    {
      auth_date: authDate,
      user: JSON.stringify({
        id: 42,
        first_name: "Test",
        username: "testuser",
      }),
      ...overrides,
    },
    BOT_TOKEN,
  );
}

describe("verifyTelegramInitData", () => {
  it("accepts valid signature and user", () => {
    const initData = validInitData();
    const verified = verifyTelegramInitData(initData, BOT_TOKEN);
    expect(verified?.profile.id).toBe(42);
    expect(verified?.profile.firstName).toBe("Test");
    expect(verified?.profile.username).toBe("testuser");
  });

  it("rejects tampered payload", () => {
    const initData = validInitData();
    const tampered = initData.replace("testuser", "hacker");
    expect(verifyTelegramInitData(tampered, BOT_TOKEN)).toBeNull();
  });

  it("rejects expired auth_date", () => {
    const initData = signTelegramInitDataForTest(
      {
        auth_date: String(Math.floor(Date.now() / 1000) - 90_000),
        user: JSON.stringify({ id: 1, first_name: "Old" }),
      },
      BOT_TOKEN,
    );
    expect(verifyTelegramInitData(initData, BOT_TOKEN)).toBeNull();
  });

  it("parses start_param", () => {
    const initData = validInitData({ start_param: "p_abc123" });
    const verified = verifyTelegramInitData(initData, BOT_TOKEN);
    expect(verified?.startParam).toBe("p_abc123");
  });

  it("accepts a hash that includes the signature field", () => {
    const initData = validInitData({ signature: "ed25519-stub" });
    expect(verifyTelegramInitData(initData, BOT_TOKEN)?.profile.id).toBe(42);
  });

  it("accepts a hash that omits the signature field", () => {
    const initData = `${validInitData()}&signature=ed25519-stub`;
    expect(verifyTelegramInitData(initData, BOT_TOKEN)?.profile.id).toBe(42);
  });
});

describe("parseTelegramInitDataUserJson", () => {
  it("returns null for invalid json", () => {
    expect(parseTelegramInitDataUserJson("{")).toBeNull();
  });
});
