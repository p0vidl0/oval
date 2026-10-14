import { describe, expect, it } from "vitest";
import { nextFailureAfterAttempt } from "@/lib/feed/social-publish-jobs";

describe("nextFailureAfterAttempt", () => {
  it("stays pending until max retries", () => {
    expect(nextFailureAfterAttempt(0, 3)).toEqual({
      attemptCount: 1,
      status: "pending",
    });
    expect(nextFailureAfterAttempt(1, 3)).toEqual({
      attemptCount: 2,
      status: "pending",
    });
  });

  it("marks failed on last attempt", () => {
    expect(nextFailureAfterAttempt(2, 3)).toEqual({
      attemptCount: 3,
      status: "failed",
    });
  });
});
