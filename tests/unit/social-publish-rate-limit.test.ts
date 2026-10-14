import { describe, expect, it } from "vitest";
import {
  resetSocialPublishRateLimitsForTests,
  SOCIAL_PUBLISH_MAX_PER_HOUR,
  tryAcquireSendSlot,
} from "@/lib/bots/social-publish/rate-limit";

describe("social publish rate limit", () => {
  it("allows up to max sends per hour per channel", () => {
    resetSocialPublishRateLimitsForTests();
    const t0 = 1_700_000_000_000;
    for (let i = 0; i < SOCIAL_PUBLISH_MAX_PER_HOUR; i++) {
      expect(tryAcquireSendSlot("telegram", t0 + i)).toBe(true);
    }
    expect(
      tryAcquireSendSlot("telegram", t0 + SOCIAL_PUBLISH_MAX_PER_HOUR),
    ).toBe(false);
  });

  it("frees a slot after the window slides", () => {
    resetSocialPublishRateLimitsForTests();
    const t0 = 1_700_000_000_000;
    for (let i = 0; i < SOCIAL_PUBLISH_MAX_PER_HOUR; i++) {
      tryAcquireSendSlot("telegram", t0 + i);
    }
    expect(tryAcquireSendSlot("telegram", t0 + 3_600_001)).toBe(true);
  });
});
