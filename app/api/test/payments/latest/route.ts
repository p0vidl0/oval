import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { payments } from "@/lib/db/schema";
import { isTestApiEnabled } from "@/lib/test-api";

export async function GET(request: Request) {
  if (!isTestApiEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const registrationId = url.searchParams.get("registration_id");
  if (!registrationId) {
    return NextResponse.json(
      { error: "registration_id required" },
      { status: 400 },
    );
  }

  const rows = await db
    .select()
    .from(payments)
    .where(eq(payments.registrationId, registrationId))
    .limit(1);
  const payment = rows[0];
  if (!payment) {
    return NextResponse.json({ error: "no payment" }, { status: 404 });
  }

  return NextResponse.json({
    payment_id: payment.id,
    status: payment.status,
  });
}
