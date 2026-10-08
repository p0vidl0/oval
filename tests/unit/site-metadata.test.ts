import { describe, expect, it } from "vitest";
import { metaDescriptionFromBody } from "@/lib/site/public-origin";

describe("metaDescriptionFromBody", () => {
  it("returns fallback for empty body", () => {
    expect(metaDescriptionFromBody("", "fallback")).toBe("fallback");
  });

  it("truncates long text", () => {
    const long = "а".repeat(200);
    const out = metaDescriptionFromBody(long, "fallback");
    expect(out.length).toBeLessThanOrEqual(160);
    expect(out.endsWith("…")).toBe(true);
  });
});
