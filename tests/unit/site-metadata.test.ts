import { describe, expect, it } from "vitest";
import {
  capitalizePageTitle,
  metaDescriptionFromBody,
  pageDocumentTitle,
  siteDocumentTitle,
} from "@/lib/site/public-origin";

describe("capitalizePageTitle", () => {
  it("makes the first letter uppercase", () => {
    expect(capitalizePageTitle("лента")).toBe("Лента");
    expect(capitalizePageTitle("  политика конфиденциальности")).toBe(
      "Политика конфиденциальности",
    );
  });

  it("keeps an already capitalized title", () => {
    expect(capitalizePageTitle("Сегодня")).toBe("Сегодня");
    expect(siteDocumentTitle).toBe("Ночная Лига");
  });

  it("returns empty for a blank title", () => {
    expect(capitalizePageTitle("   ")).toBe("");
  });

  it("builds the browser title", () => {
    expect(pageDocumentTitle("лента")).toBe("Лента | Ночная Лига");
    expect(pageDocumentTitle("   ")).toBe(siteDocumentTitle);
  });
});

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
