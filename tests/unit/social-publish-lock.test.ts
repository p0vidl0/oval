import { describe, expect, it } from "vitest";
import {
  releaseInFlightLock,
  resetInFlightLocksForTests,
  tryAcquireInFlightLock,
} from "@/lib/bots/social-publish/in-flight-lock";

describe("in-flight lock", () => {
  it("lives on globalThis so split bundles share it", () => {
    resetInFlightLocksForTests();
    expect(tryAcquireInFlightLock("telegram", "post-1")).toBe(true);
    const held = (globalThis as { __ovalSocialPublishInFlight?: Set<string> })
      .__ovalSocialPublishInFlight;
    expect(held?.has("telegram:post-1")).toBe(true);
    expect(tryAcquireInFlightLock("telegram", "post-1")).toBe(false);
    releaseInFlightLock("telegram", "post-1");
    expect(tryAcquireInFlightLock("telegram", "post-1")).toBe(true);
    resetInFlightLocksForTests();
  });
});
