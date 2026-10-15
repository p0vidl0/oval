import { NextResponse } from "next/server";
import { getTelegramWebhookSecret } from "@/lib/auth/telegram/config";
import {
  handleTelegramUpdate,
  type TelegramUpdate,
} from "@/lib/bots/telegram/webhook";
import { secretsMatch } from "@/lib/security/timing-safe-secret";

export async function POST(request: Request) {
  const secret = getTelegramWebhookSecret();
  if (!secret) {
    return NextResponse.json(
      { error: "Telegram webhook not configured" },
      { status: 503 },
    );
  }

  const presented = request.headers.get("x-telegram-bot-api-secret-token");
  if (!presented || !secretsMatch(presented, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    await handleTelegramUpdate(update);
  } catch (err) {
    console.error("[telegram webhook]", err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
