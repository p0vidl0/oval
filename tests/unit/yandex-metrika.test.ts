import { afterEach, describe, expect, it } from "vitest";
import {
  getYandexMetrikaCounterId,
  yandexMetrikaInitScript,
  yandexMetrikaTagJsUrl,
} from "@/lib/analytics/yandex-metrika";

describe("getYandexMetrikaCounterId", () => {
  afterEach(() => {
    delete process.env.YANDEX_METRIKA_COUNTER_ID;
  });

  it("returns trimmed numeric id", () => {
    process.env.YANDEX_METRIKA_COUNTER_ID = " 113587963 ";
    expect(getYandexMetrikaCounterId()).toBe("113587963");
  });

  it("returns null for missing or invalid id", () => {
    expect(getYandexMetrikaCounterId()).toBeNull();
    process.env.YANDEX_METRIKA_COUNTER_ID = "abc";
    expect(getYandexMetrikaCounterId()).toBeNull();
  });
});

describe("yandexMetrikaInitScript", () => {
  it("includes tag url and init options", () => {
    const id = "113587963";
    const script = yandexMetrikaInitScript(id);
    expect(script).toContain(yandexMetrikaTagJsUrl(id));
    expect(script).toContain(`ym(${id}, 'init'`);
    expect(script).toContain("webvisor:true");
    expect(script).toContain('ecommerce:"dataLayer"');
  });
});
