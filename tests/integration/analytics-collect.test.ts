import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { POST } from "@/app/api/analytics/collect/route";
import { resetAnalyticsRateLimitsForTests } from "@/lib/analytics/rate-limit";
import { recordServerEvent } from "@/lib/analytics/record-event";
import { db } from "@/lib/db/client";
import { analyticsEvents } from "@/lib/db/schema";
import { useIntegrationDb } from "./helpers/setup";

const run = process.env.OVAL_INTEGRATION === "1" ? describe : describe.skip;

run("analytics collect", () => {
  useIntegrationDb();

  beforeAll(() => {
    process.env.OVAL_ANALYTICS_ENABLED = "1";
  });

  it("returns 403 without consent flag", async () => {
    resetAnalyticsRateLimitsForTests();
    const req = new Request("http://localhost/api/analytics/collect", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "vitest",
      },
      body: JSON.stringify({
        name: "page_view",
        visitorId: "550e8400-e29b-41d4-a716-446655440000",
        path: "/feed",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("stores client event with consent", async () => {
    resetAnalyticsRateLimitsForTests();
    const visitorId = "550e8400-e29b-41d4-a716-446655440000";
    const req = new Request("http://localhost/api/analytics/collect", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0",
      },
      body: JSON.stringify({
        name: "page_view",
        visitorId,
        path: "/feed",
        consent: true,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(204);

    const rows = await db
      .select()
      .from(analyticsEvents)
      .where(eq(analyticsEvents.visitorId, visitorId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.source).toBe("client");
  });

  it("stores server event without visitor id", async () => {
    await recordServerEvent({
      name: "registration_complete",
      path: "/feed/post-1",
      props: { registrationId: "reg-1", sessionId: "sess-1" },
    });

    const rows = await db
      .select()
      .from(analyticsEvents)
      .where(eq(analyticsEvents.name, "registration_complete"));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.visitorId).toBeNull();
    expect(rows[0]?.source).toBe("server");
  });
});
