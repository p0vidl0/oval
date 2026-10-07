import { describe, expect, it } from "vitest";
import {
  escapeTelegramHtml,
  formatFeedPostTelegramHtml,
  formatTelegramAnnouncementDateLine,
  formatTrainingAnnouncementTelegramHtml,
} from "@/lib/bots/telegram/format-message";

describe("formatFeedPostTelegramHtml", () => {
  it("escapes html in title and body", () => {
    const html = formatFeedPostTelegramHtml("A & B", "<script>");
    expect(html).toBe("<b>A &amp; B</b>\n\n&lt;script&gt;");
  });

  it("title only when body empty", () => {
    expect(formatFeedPostTelegramHtml("Hi", "")).toBe("<b>Hi</b>");
  });
});

describe("escapeTelegramHtml", () => {
  it("escapes special chars", () => {
    expect(escapeTelegramHtml("a<b>c")).toBe("a&lt;b&gt;c");
  });
});

describe("training announcement telegram", () => {
  // 24.03.2026 20:00 Asia/Omsk
  const startsAt = new Date("2026-03-24T14:00:00.000Z");

  it("formats date line", () => {
    expect(formatTelegramAnnouncementDateLine(startsAt)).toBe(
      "🚴‍♂️ 24.03 (вторник)",
    );
  });

  it("formats schedule + body", () => {
    expect(
      formatTrainingAnnouncementTelegramHtml(startsAt, "Ждём на треке"),
    ).toBe("🚴‍♂️ 24.03 (вторник)\n🕗 Начало в 20:00\n\nЖдём на треке");
  });
});
