import { describe, expect, it } from "vitest";
import {
  clearEmailRecordingStore,
  getLatestEmailOtp,
} from "@/lib/email/recording-store";
import { sendAuthEmailOtp } from "@/lib/email/send-otp";

const run = process.env.OVAL_INTEGRATION === "1" ? describe : describe.skip;

run("email recording", () => {
  it("stores otp when EMAIL_PROVIDER=recording", async () => {
    clearEmailRecordingStore();
    process.env.EMAIL_PROVIDER = "recording";
    await sendAuthEmailOtp("user@example.com", "123456");
    const record = getLatestEmailOtp("user@example.com");
    expect(record?.code).toBe("123456");
  });
});
