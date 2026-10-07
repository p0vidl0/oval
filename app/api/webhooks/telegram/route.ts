import { NextResponse } from "next/server";
import { getTelegramWebhookSecret } from "@/lib/auth/telegram/config";
import {
  handleTelegramUpdate,
  type TelegramUpdate,
} from "@/lib/bots/telegram/webhook";

export async function POST(request: Request) {
  const secret = getTelegramWebhookSecret();
  if (!secret) {
    return NextResponse.json(
      { error: "Telegram webhook not configured" },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  if (url.searchParams.get("secret") !== secret) {
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
