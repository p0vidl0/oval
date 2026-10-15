import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { payments } from "@/lib/db/schema";
import { getPaymentWebhookSecret } from "@/lib/payments/config";
import { confirmPaymentSucceeded } from "@/lib/payments/confirm-payment";
import { secretsMatch } from "@/lib/security/timing-safe-secret";

function statedAmountCents(body: Record<string, unknown>): number | undefined {
  if (
    !("amount" in body) &&
    !("amount_cents" in body) &&
    !("amountCents" in body)
  ) {
    return undefined;
  }
  const raw = body.amount_cents ?? body.amountCents ?? body.amount;
  if (typeof raw === "number" && Number.isInteger(raw)) return raw;
  if (typeof raw === "string" && /^-?\d+$/.test(raw)) return Number(raw);
  return Number.NaN;
}

type RouteContext = { params: Promise<{ provider: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { provider } = await context.params;
  const secret = getPaymentWebhookSecret();
  if (!secret) {
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 503 },
    );
  }

  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  const headerSecret = request.headers.get("x-payment-webhook-secret");
  const bearerOk = bearer !== null && secretsMatch(bearer, secret);
  const headerOk = headerSecret !== null && secretsMatch(headerSecret, secret);
  if (!bearerOk && !headerOk) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventId = String(body.event_id ?? body.eventId ?? "");
  const paymentId = String(body.payment_id ?? body.paymentId ?? "");
  const externalId = body.external_id
    ? String(body.external_id)
    : body.externalId
      ? String(body.externalId)
      : undefined;

  if (!eventId || !paymentId) {
    return NextResponse.json(
      { error: "event_id and payment_id required" },
      { status: 400 },
    );
  }

  const paymentRows = await db
    .select()
    .from(payments)
    .where(eq(payments.id, paymentId))
    .limit(1);
  const payment = paymentRows[0];
  if (!payment || payment.provider !== provider) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  if (body.status !== "succeeded") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const amountCents = statedAmountCents(body);
  if (amountCents !== undefined && amountCents !== payment.amountCents) {
    return NextResponse.json({ error: "Amount mismatch" }, { status: 422 });
  }

  const result = await confirmPaymentSucceeded({
    paymentId,
    provider,
    externalId,
    webhookDeliveryId: eventId,
    webhookPayload: body,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  return NextResponse.json({
    ok: true,
    alreadyProcessed: result.alreadyProcessed,
    paymentId: result.paymentId,
  });
}
