import { describe, expect, it } from "vitest";
import { maxImagesForPostType } from "@/lib/feed/post-image-limits";

describe("maxImagesForPostType", () => {
  it("allows one image for training announcements", () => {
    expect(maxImagesForPostType("training_announcement")).toBe(1);
  });

  it("allows ten images for news", () => {
    expect(maxImagesForPostType("news")).toBe(10);
  });
});
