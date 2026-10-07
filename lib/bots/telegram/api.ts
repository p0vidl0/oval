import { getTelegramBotToken } from "@/lib/auth/telegram/config";
import { telegramBotMethodUrl } from "@/lib/bots/telegram/api-root";
import type { PostUploadFile } from "@/lib/uploads/storage";

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

async function parseTelegramResponse(
  method: string,
  res: Response,
): Promise<TelegramApiResult> {
  const payload = (await res.json()) as TelegramApiResult;
  if (!res.ok || !payload.ok) {
    throw new Error(
      `Telegram ${method} failed: ${res.status} ${payload.description ?? JSON.stringify(payload)}`,
    );
  }
  return payload;
}

async function callTelegramBotApi(
  method: string,
  body: Record<string, unknown>,
): Promise<TelegramApiResult> {
  const token = getTelegramBotToken();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not configured");

  const res = await fetch(telegramBotMethodUrl(token, method), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return parseTelegramResponse(method, res);
}

type MultipartFile = {
  fieldName: string;
  filename: string;
  contentType: string;
  data: Buffer;
};

async function callTelegramBotApiMultipart(
  method: string,
  fields: Record<string, string | undefined>,
  files: MultipartFile[],
): Promise<TelegramApiResult> {
  const token = getTelegramBotToken();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not configured");

  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) form.append(key, value);
  }
  for (const file of files) {
    form.append(
      file.fieldName,
      new Blob([Uint8Array.from(file.data)], { type: file.contentType }),
      file.filename,
    );
  }

  const res = await fetch(telegramBotMethodUrl(token, method), {
    method: "POST",
    body: form,
  });

  return parseTelegramResponse(method, res);
}

function firstMessageId(payload: TelegramApiResult): number {
  const id =
    payload.result?.message_id ?? payload.result?.message_ids?.[0] ?? null;
  if (id == null) {
    throw new Error("Telegram API returned no message_id");
  }
  return id;
}

function replyMarkupField(
  options?: SendTelegramMessageOptions,
): string | undefined {
  if (!options?.inline_keyboard?.length) return undefined;
  return JSON.stringify({ inline_keyboard: options.inline_keyboard });
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

export async function sendTelegramPhotoUpload(
  chatId: string | number,
  photo: PostUploadFile,
  caption: string,
  options?: SendTelegramMessageOptions,
): Promise<{ messageId: number }> {
  const payload = await callTelegramBotApiMultipart(
    "sendPhoto",
    {
      chat_id: String(chatId),
      caption,
      parse_mode: options?.parse_mode,
      reply_markup: replyMarkupField(options),
    },
    [
      {
        fieldName: "photo",
        filename: photo.filename,
        contentType: photo.contentType,
        data: photo.data,
      },
    ],
  );
  return { messageId: firstMessageId(payload) };
}

export async function sendTelegramMediaGroupUpload(
  chatId: string | number,
  photos: PostUploadFile[],
  captionOnFirst: string,
  options?: Pick<SendTelegramMessageOptions, "parse_mode">,
): Promise<{ messageIds: number[] }> {
  if (photos.length === 0) {
    throw new Error("sendTelegramMediaGroupUpload requires at least one photo");
  }

  const media = photos.map((_photo, index) => {
    const attachName = `photo${index}`;
    return {
      type: "photo" as const,
      media: `attach://${attachName}`,
      ...(index === 0
        ? { caption: captionOnFirst, parse_mode: options?.parse_mode }
        : {}),
    };
  });

  const payload = await callTelegramBotApiMultipart(
    "sendMediaGroup",
    {
      chat_id: String(chatId),
      media: JSON.stringify(media),
    },
    photos.map((photo, index) => ({
      fieldName: `photo${index}`,
      filename: photo.filename,
      contentType: photo.contentType,
      data: photo.data,
    })),
  );

  const ids = payload.result?.message_ids;
  if (!ids?.length) {
    throw new Error("Telegram sendMediaGroup returned no message_ids");
  }
  return { messageIds: ids };
}
