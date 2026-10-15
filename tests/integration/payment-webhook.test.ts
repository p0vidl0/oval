import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { POST } from "@/app/api/webhooks/payment/[provider]/route";
import { db } from "@/lib/db/client";
import { payments } from "@/lib/db/schema";
import {
  seedPendingPayment,
  seedPublishedAnnouncement,
  seedRegistration,
  seedUser,
} from "./helpers/seed";
import { useIntegrationDb } from "./helpers/setup";

const run = process.env.OVAL_INTEGRATION === "1" ? describe : describe.skip;

run("payment webhook route", () => {
  useIntegrationDb();

  beforeAll(() => {
    process.env.PAYMENT_WEBHOOK_SECRET = "test-webhook-secret";
  });

  it("returns 401 without secret", async () => {
    const req = new Request("http://localhost/api/webhooks/payment/mock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: "e1",
        payment_id: "missing",
        status: "succeeded",
      }),
    });
    const res = await POST(req, {
      params: Promise.resolve({ provider: "mock" }),
    });
    expect(res.status).toBe(401);
  });

  it("confirms payment with valid payload", async () => {
    const userId = await seedUser("wh-user-1");
    const { sessionId } = await seedPublishedAnnouncement({ priceCents: 5000 });
    const regId = await seedRegistration(userId, sessionId);
    const paymentId = await seedPendingPayment(userId, regId, 5000);

    const req = new Request("http://localhost/api/webhooks/payment/mock", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-webhook-secret",
      },
      body: JSON.stringify({
        event_id: "wh-evt-99",
        payment_id: paymentId,
        status: "succeeded",
      }),
    });
    const res = await POST(req, {
      params: Promise.resolve({ provider: "mock" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.alreadyProcessed).toBe(false);

    const req2 = new Request("http://localhost/api/webhooks/payment/mock", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-webhook-secret",
      },
      body: JSON.stringify({
        event_id: "wh-evt-99",
        payment_id: paymentId,
        status: "succeeded",
      }),
    });
    const res2 = await POST(req2, {
      params: Promise.resolve({ provider: "mock" }),
    });
    const body2 = await res2.json();
    expect(body2.alreadyProcessed).toBe(true);
  });

  it("ignores a payload without status", async () => {
    const userId = await seedUser("wh-user-nostatus");
    const { sessionId } = await seedPublishedAnnouncement({ priceCents: 5000 });
    const regId = await seedRegistration(userId, sessionId);
    const paymentId = await seedPendingPayment(userId, regId, 5000);

    const req = new Request("http://localhost/api/webhooks/payment/mock", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-webhook-secret",
      },
      body: JSON.stringify({
        event_id: "wh-evt-no-status",
        payment_id: paymentId,
      }),
    });
    const res = await POST(req, {
      params: Promise.resolve({ provider: "mock" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ignored).toBe(true);

    const rows = await db
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId));
    expect(rows[0]?.status).toBe("pending");
  });

  it("rejects a mismatched amount", async () => {
    const userId = await seedUser("wh-user-amount");
    const { sessionId } = await seedPublishedAnnouncement({ priceCents: 5000 });
    const regId = await seedRegistration(userId, sessionId);
    const paymentId = await seedPendingPayment(userId, regId, 5000);

    const req = new Request("http://localhost/api/webhooks/payment/mock", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-webhook-secret",
      },
      body: JSON.stringify({
        event_id: "wh-evt-amount",
        payment_id: paymentId,
        status: "succeeded",
        amount_cents: 1,
      }),
    });
    const res = await POST(req, {
      params: Promise.resolve({ provider: "mock" }),
    });
    expect(res.status).toBe(422);

    const rows = await db
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId));
    expect(rows[0]?.status).toBe("pending");
  });
});
