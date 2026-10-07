import { describe, expect, it } from "vitest";
import {
  buildMiniAppStartParamPay,
  buildMiniAppStartParamPost,
  resolveStartParamRoute,
} from "@/lib/telegram/mini-app-start-param";

describe("resolveStartParamRoute", () => {
  it("maps post prefix", () => {
    expect(resolveStartParamRoute("p_abc-123")).toEqual({
      kind: "post",
      postId: "abc-123",
      path: "/feed/abc-123",
    });
  });

  it("maps pay prefix", () => {
    expect(resolveStartParamRoute("pay_reg_1")).toEqual({
      kind: "pay",
      registrationId: "reg_1",
      path: "/cabinet/pay/reg_1",
    });
  });

  it("ignores bot login payloads", () => {
    expect(resolveStartParamRoute("login_token123")).toBeNull();
  });

  it("rejects path injection", () => {
    expect(resolveStartParamRoute("p_../admin")).toBeNull();
    expect(resolveStartParamRoute("p_")).toBeNull();
  });
});

describe("buildMiniAppStartParam helpers", () => {
  it("builds stable prefixes", () => {
    expect(buildMiniAppStartParamPost("x")).toBe("p_x");
    expect(buildMiniAppStartParamPay("y")).toBe("pay_y");
  });
});
