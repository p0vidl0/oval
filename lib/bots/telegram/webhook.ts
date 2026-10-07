import {
  getTelegramBotUsername,
  isTelegramBotLoginConfigured,
} from "@/lib/auth/telegram/config";
import {
  markTelegramLoginIntentReady,
  parseTelegramLoginStartPayload,
} from "@/lib/auth/telegram/login-intent";
import { sendTelegramMessage } from "@/lib/bots/telegram/api";

export type TelegramUpdate = {
  message?: {
    message_id: number;
    chat: { id: number; type: string };
    text?: string;
    from?: {
      id: number;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
  };
};

function completeLoginUrl(token: string, next?: string): string {
  const base = process.env.BETTER_AUTH_URL?.replace(/\/$/, "");
  if (!base) throw new Error("BETTER_AUTH_URL not configured");
  const url = new URL("/login/telegram/complete", base);
  url.searchParams.set("token", token);
  if (next) url.searchParams.set("next", next);
  return url.toString();
}

export async function handleTelegramUpdate(
  update: TelegramUpdate,
): Promise<void> {
  if (!isTelegramBotLoginConfigured()) return;

  const message = update.message;
  if (!message?.text || !message.from) return;

  const token = parseTelegramLoginStartPayload(message.text);
  if (!token) return;

  const record = await markTelegramLoginIntentReady(token, {
    telegramId: message.from.id,
    chatId: message.chat.id,
    firstName: message.from.first_name,
    lastName: message.from.last_name,
    username: message.from.username,
  });

  if (!record) {
    await sendTelegramMessage(
      message.chat.id,
      "Ссылка для входа недействительна или уже использована. Вернитесь на сайт и попробуйте снова.",
    );
    return;
  }

  const loginUrl = completeLoginUrl(token, record.next);
  const botUsername = getTelegramBotUsername();

  await sendTelegramMessage(
    message.chat.id,
    botUsername
      ? "Нажмите кнопку ниже, чтобы завершить вход на сайте."
      : "Откройте ссылку, чтобы завершить вход на сайте.",
    {
      inline_keyboard: [[{ text: "Войти на сайт", url: loginUrl }]],
    },
  );
}
