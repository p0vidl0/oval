import { NextResponse } from "next/server";
import { isTelegramBotLoginConfigured } from "@/lib/auth/telegram/config";
import { markTelegramLoginIntentReady } from "@/lib/auth/telegram/login-intent";
import { isTestApiEnabled } from "@/lib/test-api";

export async function POST(request: Request) {
  if (!isTestApiEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!isTelegramBotLoginConfigured()) {
    return NextResponse.json(
      { error: "Telegram bot login is not configured" },
      { status: 503 },
    );
  }

  let body: {
    intentToken?: string;
    telegramUserId?: number;
    firstName?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const intentToken = body.intentToken?.trim();
  const telegramUserId = body.telegramUserId;
  if (!intentToken || intentToken.length < 8) {
    return NextResponse.json(
      { error: "intentToken required" },
      { status: 400 },
    );
  }
  if (!telegramUserId || !Number.isFinite(telegramUserId)) {
    return NextResponse.json(
      { error: "telegramUserId required" },
      { status: 400 },
    );
  }

  const record = await markTelegramLoginIntentReady(intentToken, {
    telegramId: telegramUserId,
    chatId: telegramUserId,
    firstName: body.firstName?.trim() || "E2E Telegram",
    username: "e2e_bot_user",
  });

  if (!record) {
    return NextResponse.json(
      { error: "Intent not found or expired" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    hasLinkToken: Boolean(record.linkToken),
  });
}
