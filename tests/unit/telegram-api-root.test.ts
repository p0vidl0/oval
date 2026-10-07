import { afterEach, describe, expect, it } from "vitest";
import {
  getTelegramApiRoot,
  telegramBotMethodUrl,
} from "@/lib/bots/telegram/api-root";

describe("telegram Bot API root", () => {
  afterEach(() => {
    delete process.env.TELEGRAM_API_ROOT;
  });

  it("defaults to api.telegram.org", () => {
    expect(getTelegramApiRoot()).toBe("https://api.telegram.org");
    expect(telegramBotMethodUrl("tok", "sendMessage")).toBe(
      "https://api.telegram.org/bottok/sendMessage",
    );
  });

  it("uses TELEGRAM_API_ROOT without trailing slash", () => {
    process.env.TELEGRAM_API_ROOT = "https://tg-proxy.example.com/";
    expect(getTelegramApiRoot()).toBe("https://tg-proxy.example.com");
    expect(telegramBotMethodUrl("abc", "getMe")).toBe(
      "https://tg-proxy.example.com/botabc/getMe",
    );
  });
});
