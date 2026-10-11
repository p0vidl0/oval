import { NextResponse } from "next/server";
import { isOvalAnalyticsEnabled } from "@/lib/analytics/config";
import { checkAnalyticsRateLimit } from "@/lib/analytics/rate-limit";
import { recordClientEvent } from "@/lib/analytics/record-event";
import { parseCollectAnalyticsBody } from "@/lib/analytics/schema";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isOvalAnalyticsEnabled()) {
    return new NextResponse(null, { status: 404 });
  }

  let raw: unknown;
  try {
    const text = await request.text();
    if (text.length > 4096) {
      return NextResponse.json({ error: "payload too large" }, { status: 413 });
    }
    raw = text ? JSON.parse(text) : null;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = parseCollectAnalyticsBody(raw);
  if (!parsed.ok) {
    const status = parsed.error === "consent required" ? 403 : 400;
    return NextResponse.json({ error: parsed.error }, { status });
  }

  const userAgent = request.headers.get("user-agent");
  if (!userAgent?.trim() && parsed.data.name === "page_view") {
    return NextResponse.json({ error: "invalid client" }, { status: 400 });
  }

  const rateKey = parsed.data.visitorId;
  if (!checkAnalyticsRateLimit(rateKey)) {
    return new NextResponse(null, { status: 429 });
  }

  await recordClientEvent(parsed.data, userAgent);

  return new NextResponse(null, { status: 204 });
}
