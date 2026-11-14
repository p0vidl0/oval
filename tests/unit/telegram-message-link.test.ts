import { describe, expect, it } from "vitest";
import { telegramChannelMessageUrl } from "@/lib/bots/telegram/message-link";

describe("telegramChannelMessageUrl", () => {
  it("links public and private channels", () => {
    expect(telegramChannelMessageUrl("@oval_channel", "319")).toBe(
      "https://t.me/oval_channel/319",
    );
    expect(telegramChannelMessageUrl("-1001234567890", "319")).toBe(
      "https://t.me/c/1234567890/319",
    );
  });

  it("returns null without a usable id", () => {
    expect(telegramChannelMessageUrl("@oval_channel", null)).toBeNull();
    expect(telegramChannelMessageUrl(undefined, "319")).toBeNull();
    expect(telegramChannelMessageUrl("@oval_channel", "uuid-token")).toBeNull();
    expect(telegramChannelMessageUrl("-42", "319")).toBeNull();
  });
});
