import { getTelegramBotToken } from "@/lib/auth/telegram/config";

type InlineKeyboardButton = {
  text: string;
  url?: string;
};

export type SendTelegramMessageOptions = {
  parse_mode?: "HTML" | "MarkdownV2";
  inline_keyboard?: InlineKeyboardButton[][];
};

type TelegramApiResult = {
  ok: boolean;
  description?: string;
  result?: { message_id: number; message_ids?: number[] };
};

async function callTelegramBotApi(
  method: string,
  body: Record<string, unknown>,
): Promise<TelegramApiResult> {
  const token = getTelegramBotToken();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not configured");

  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = (await res.json()) as TelegramApiResult;
  if (!res.ok || !payload.ok) {
    throw new Error(
      `Telegram ${method} failed: ${res.status} ${payload.description ?? JSON.stringify(payload)}`,
    );
  }
  return payload;
}

function firstMessageId(payload: TelegramApiResult): number {
  const id =
    payload.result?.message_id ?? payload.result?.message_ids?.[0] ?? null;
  if (id == null) {
    throw new Error("Telegram API returned no message_id");
  }
  return id;
}

export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  options?: SendTelegramMessageOptions,
): Promise<{ messageId: number }> {
  const payload = await callTelegramBotApi("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: options?.parse_mode,
    reply_markup: options?.inline_keyboard
      ? { inline_keyboard: options.inline_keyboard }
      : undefined,
  });
  return { messageId: firstMessageId(payload) };
}

export async function sendTelegramPhoto(
  chatId: string | number,
  photoUrl: string,
  caption: string,
  options?: SendTelegramMessageOptions,
): Promise<{ messageId: number }> {
  const payload = await callTelegramBotApi("sendPhoto", {
    chat_id: chatId,
    photo: photoUrl,
    caption,
    parse_mode: options?.parse_mode,
    reply_markup: options?.inline_keyboard
      ? { inline_keyboard: options.inline_keyboard }
      : undefined,
  });
  return { messageId: firstMessageId(payload) };
}

export async function sendTelegramMediaGroup(
  chatId: string | number,
  photoUrls: string[],
  captionOnFirst: string,
  options?: Pick<SendTelegramMessageOptions, "parse_mode">,
): Promise<{ messageIds: number[] }> {
  if (photoUrls.length === 0) {
    throw new Error("sendTelegramMediaGroup requires at least one photo");
  }

  const media = photoUrls.map((url, index) => ({
    type: "photo" as const,
    media: url,
    ...(index === 0
      ? { caption: captionOnFirst, parse_mode: options?.parse_mode }
      : {}),
  }));

  const payload = await callTelegramBotApi("sendMediaGroup", {
    chat_id: chatId,
    media,
  });
  const ids = payload.result?.message_ids;
  if (!ids?.length) {
    throw new Error("Telegram sendMediaGroup returned no message_ids");
  }
  return { messageIds: ids };
}
