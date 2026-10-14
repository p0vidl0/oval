import { describe, expect, it } from "vitest";
import { telegramMessageIdsFromResult } from "@/lib/bots/telegram/api";

describe("telegramMessageIdsFromResult", () => {
  it("parses sendMediaGroup array of messages", () => {
    expect(
      telegramMessageIdsFromResult([{ message_id: 10 }, { message_id: 11 }]),
    ).toEqual([10, 11]);
  });

  it("parses single message object", () => {
    expect(telegramMessageIdsFromResult({ message_id: 42 })).toEqual([42]);
  });

  it("parses legacy message_ids wrapper", () => {
    expect(telegramMessageIdsFromResult({ message_ids: [7, 8] })).toEqual([
      7, 8,
    ]);
  });
});
