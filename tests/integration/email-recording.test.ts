import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/test/email/latest/route";
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

  it("test API returns code when enabled", async () => {
    clearEmailRecordingStore();
    process.env.EMAIL_PROVIDER = "recording";
    process.env.OVAL_TEST_API = "1";
    await sendAuthEmailOtp("e2e@oval.test", "654321");
    const req = new Request(
      "http://localhost/api/test/email/latest?email=e2e%40oval.test",
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.code).toBe("654321");
  });

  it("test API hidden when flag off", async () => {
    process.env.OVAL_TEST_API = "0";
    const req = new Request(
      "http://localhost/api/test/email/latest?email=e2e%40oval.test",
    );
    const res = await GET(req);
    expect(res.status).toBe(404);
  });
});
