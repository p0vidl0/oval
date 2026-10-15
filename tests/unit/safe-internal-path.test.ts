import { describe, expect, it } from "vitest";
import {
  optionalSafeInternalPath,
  safeInternalPath,
} from "@/lib/site/safe-internal-path";

describe("safeInternalPath", () => {
  it("keeps an in-app path", () => {
    expect(safeInternalPath("/feed/abc")).toBe("/feed/abc");
    expect(safeInternalPath("/cabinet/pay/reg-1")).toBe("/cabinet/pay/reg-1");
    expect(safeInternalPath("/admin/sessions")).toBe("/admin/sessions");
  });

  it("keeps a query string", () => {
    expect(safeInternalPath("/feed?tab=1")).toBe("/feed?tab=1");
  });

  it("replaces protocol-relative and absolute urls", () => {
    expect(safeInternalPath("//evil.example")).toBe("/cabinet");
    expect(safeInternalPath("//evil.example/phish")).toBe("/cabinet");
    expect(safeInternalPath("https://evil.example/feed")).toBe("/cabinet");
    expect(safeInternalPath("https://velodrom55.ru/feed")).toBe("/cabinet");
  });

  it("replaces backslash and empty input", () => {
    expect(safeInternalPath("/\\evil.example")).toBe("/cabinet");
    expect(safeInternalPath(null)).toBe("/cabinet");
    expect(safeInternalPath("")).toBe("/cabinet");
  });

  it("optional form drops an attack path", () => {
    expect(optionalSafeInternalPath("/feed/1")).toBe("/feed/1");
    expect(optionalSafeInternalPath("//evil.example")).toBeUndefined();
    expect(optionalSafeInternalPath(undefined)).toBeUndefined();
  });
});
