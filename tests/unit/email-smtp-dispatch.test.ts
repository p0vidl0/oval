import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/email/send-via-smtp", () => ({
  sendViaSmtp: vi.fn(),
}));

import { sendAuthEmailOtp } from "@/lib/email/send-otp";
import { sendViaSmtp } from "@/lib/email/send-via-smtp";

describe("sendAuthEmailOtp smtp", () => {
  const prev = {
    provider: process.env.EMAIL_PROVIDER,
    disableLimits: process.env.OVAL_DISABLE_OTP_LIMITS,
  };

  afterEach(() => {
    process.env.EMAIL_PROVIDER = prev.provider;
    process.env.OVAL_DISABLE_OTP_LIMITS = prev.disableLimits;
    vi.mocked(sendViaSmtp).mockReset();
  });

  it("returns before the smtp relay finishes", async () => {
    let release: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.mocked(sendViaSmtp).mockReturnValue(pending);

    process.env.EMAIL_PROVIDER = "smtp";
    process.env.OVAL_DISABLE_OTP_LIMITS = "1";

    const started = Date.now();
    await sendAuthEmailOtp("rider@example.com", "123456");
    expect(Date.now() - started).toBeLessThan(500);
    expect(sendViaSmtp).toHaveBeenCalledWith(
      "rider@example.com",
      "Код входа в Ночную Лигу",
      expect.stringContaining("123456"),
    );

    release?.();
    await pending;
  });
});
