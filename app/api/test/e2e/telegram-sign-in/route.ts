import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isTelegramBotLoginConfigured } from "@/lib/auth/telegram/config";
import {
  createTelegramLoginIntent,
  markTelegramLoginIntentReady,
} from "@/lib/auth/telegram/login-intent";
import { isTestApiEnabled } from "@/lib/test-api";

type TelegramAuthApi = {
  signInTelegramBot: (input: {
    body: { token: string };
    headers: Headers;
    asResponse?: boolean;
  }) => Promise<Response>;
};

async function signInTelegramForE2e(
  request: Request,
  telegramUserId: number,
  firstName: string,
): Promise<Response> {
  const { token } = await createTelegramLoginIntent("/cabinet");
  const ready = await markTelegramLoginIntentReady(token, {
    telegramId: telegramUserId,
    chatId: telegramUserId,
    firstName,
    username: "e2e_user",
  });
  if (!ready) {
    return NextResponse.json(
      { error: "Intent prepare failed" },
      { status: 500 },
    );
  }

  const origin =
    process.env.BETTER_AUTH_URL?.replace(/\/$/, "") ??
    new URL(request.url).origin;
  const headers = new Headers(request.headers);
  headers.set("origin", origin);
  headers.set("content-type", "application/json");

  const api = auth.api as unknown as TelegramAuthApi;
  return api.signInTelegramBot({
    body: { token },
    headers,
    asResponse: true,
  });
}

function redirectWithAuthCookies(
  authResponse: Response,
  nextPath: string,
  origin: string,
): NextResponse {
  if (!authResponse.ok) {
    return NextResponse.redirect(
      new URL(`/login?next=${encodeURIComponent(nextPath)}`, origin),
    );
  }
  const redirect = NextResponse.redirect(new URL(nextPath, origin));
  for (const cookie of authResponse.headers.getSetCookie()) {
    redirect.headers.append("Set-Cookie", cookie);
  }
  return redirect;
}

export async function GET(request: Request) {
  if (!isTestApiEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!isTelegramBotLoginConfigured()) {
    return NextResponse.json(
      { error: "Telegram bot login is not configured" },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const telegramUserId = Number(url.searchParams.get("telegramUserId"));
  const next = url.searchParams.get("next")?.trim() || "/cabinet";
  const firstName = url.searchParams.get("firstName")?.trim() || "E2E Telegram";

  if (!Number.isFinite(telegramUserId)) {
    return NextResponse.json(
      { error: "telegramUserId query required" },
      { status: 400 },
    );
  }

  const origin = process.env.BETTER_AUTH_URL?.replace(/\/$/, "") ?? url.origin;
  const authResponse = await signInTelegramForE2e(
    request,
    telegramUserId,
    firstName,
  );
  return redirectWithAuthCookies(authResponse, next, origin);
}

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

  let body: { telegramUserId?: number; firstName?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const telegramUserId = body.telegramUserId;
  if (!telegramUserId || !Number.isFinite(telegramUserId)) {
    return NextResponse.json(
      { error: "telegramUserId required" },
      { status: 400 },
    );
  }

  return signInTelegramForE2e(
    request,
    telegramUserId,
    body.firstName?.trim() || "E2E Telegram",
  );
}
