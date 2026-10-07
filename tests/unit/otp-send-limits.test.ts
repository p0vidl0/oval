import { describe, expect, it } from "vitest";
import {
  decideOtpSendAllowed,
  type OtpSendLimitConfig,
  readOtpSendLimitConfig,
} from "@/lib/email/otp-send-limit-policy";

const config: OtpSendLimitConfig = {
  minIntervalSec: 120,
  maxPerEmailPerDay: 10,
  maxSmtpPerHour: 200,
};

const now = new Date("2026-01-15T12:00:00.000Z");

describe("decideOtpSendAllowed", () => {
  it("allows first send", () => {
    expect(
      decideOtpSendAllowed({
        now,
        lastSentAt: null,
        sendsLast24h: 0,
        sendsLastHourGlobal: 0,
        config,
      }).allowed,
    ).toBe(true);
  });

  it("blocks when global hourly cap reached", () => {
    const result = decideOtpSendAllowed({
      now,
      lastSentAt: null,
      sendsLast24h: 0,
      sendsLastHourGlobal: 200,
      config,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toBe("global_hourly_cap");
    }
  });

  it("blocks when per-email daily cap reached", () => {
    const result = decideOtpSendAllowed({
      now,
      lastSentAt: new Date("2026-01-15T10:00:00.000Z"),
      sendsLast24h: 10,
      sendsLastHourGlobal: 1,
      config,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toBe("per_email_daily_cap");
    }
  });

  it("blocks when min interval not elapsed", () => {
    const result = decideOtpSendAllowed({
      now,
      lastSentAt: new Date("2026-01-15T11:59:00.000Z"),
      sendsLast24h: 1,
      sendsLastHourGlobal: 1,
      config,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toBe("per_email_interval");
    }
  });

  it("allows after min interval", () => {
    expect(
      decideOtpSendAllowed({
        now,
        lastSentAt: new Date("2026-01-15T11:57:00.000Z"),
        sendsLast24h: 1,
        sendsLastHourGlobal: 1,
        config,
      }).allowed,
    ).toBe(true);
  });
});

describe("readOtpSendLimitConfig", () => {
  it("uses defaults when env unset", () => {
    const prev = {
      a: process.env.EMAIL_OTP_MIN_INTERVAL_SEC,
      b: process.env.EMAIL_OTP_MAX_PER_EMAIL_PER_DAY,
      c: process.env.EMAIL_OTP_MAX_SMTP_PER_HOUR,
    };
    delete process.env.EMAIL_OTP_MIN_INTERVAL_SEC;
    delete process.env.EMAIL_OTP_MAX_PER_EMAIL_PER_DAY;
    delete process.env.EMAIL_OTP_MAX_SMTP_PER_HOUR;
    expect(readOtpSendLimitConfig()).toEqual({
      minIntervalSec: 120,
      maxPerEmailPerDay: 10,
      maxSmtpPerHour: 200,
    });
    process.env.EMAIL_OTP_MIN_INTERVAL_SEC = prev.a;
    process.env.EMAIL_OTP_MAX_PER_EMAIL_PER_DAY = prev.b;
    process.env.EMAIL_OTP_MAX_SMTP_PER_HOUR = prev.c;
  });
});
