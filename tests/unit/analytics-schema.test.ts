import { describe, expect, it } from "vitest";
import {
  ANALYTICS_CONSENT_STORAGE_KEY,
  parseAnalyticsConsent,
  readAnalyticsConsentFromStorage,
  writeAnalyticsConsentToStorage,
} from "@/lib/analytics/consent";
import { normalizeReferrer } from "@/lib/analytics/referrer";
import { parseCollectAnalyticsBody } from "@/lib/analytics/schema";
import { utmFromSearchParams } from "@/lib/analytics/utm";

describe("parseCollectAnalyticsBody", () => {
  it("requires consent", () => {
    const result = parseCollectAnalyticsBody({
      name: "page_view",
      visitorId: "550e8400-e29b-41d4-a716-446655440000",
      path: "/feed",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("consent required");
  });

  it("accepts valid page_view", () => {
    const result = parseCollectAnalyticsBody({
      name: "page_view",
      visitorId: "550e8400-e29b-41d4-a716-446655440000",
      path: "/feed",
      consent: true,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects admin paths", () => {
    const result = parseCollectAnalyticsBody({
      name: "page_view",
      visitorId: "550e8400-e29b-41d4-a716-446655440000",
      path: "/admin/sessions",
      consent: true,
    });
    expect(result.ok).toBe(false);
  });
});

describe("consent storage", () => {
  it("parses granted/denied", () => {
    expect(parseAnalyticsConsent("granted")).toBe("granted");
    expect(parseAnalyticsConsent("denied")).toBe("denied");
    expect(parseAnalyticsConsent("x")).toBeNull();
  });
});

describe("normalizeReferrer", () => {
  it("strips query from url referrer", () => {
    expect(normalizeReferrer("https://t.me/channel/post?utm=1")).toBe(
      "https://t.me/channel/post",
    );
  });
});

describe("utmFromSearchParams", () => {
  it("reads utm fields", () => {
    const params = new URLSearchParams("utm_source=telegram&utm_campaign=mar");
    expect(utmFromSearchParams(params)).toEqual({
      utmSource: "telegram",
      utmMedium: undefined,
      utmCampaign: "mar",
      utmContent: undefined,
      utmTerm: undefined,
    });
  });
});

describe("writeAnalyticsConsentToStorage", () => {
  it("persists to localStorage when available", () => {
    const store = new Map<string, string>();
    const original = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
      },
    });
    writeAnalyticsConsentToStorage("granted");
    expect(readAnalyticsConsentFromStorage()).toBe("granted");
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: original,
    });
    expect(ANALYTICS_CONSENT_STORAGE_KEY).toBe("oval_analytics_consent");
  });
});
