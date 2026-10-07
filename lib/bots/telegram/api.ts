import { getTelegramBotToken } from "@/lib/auth/telegram/config";

type InlineKeyboardButton = {
  text: string;
  url?: string;
};

export async function sendTelegramMessage(
  chatId: number,
  text: string,
  replyMarkup?: { inline_keyboard: InlineKeyboardButton[][] },
): Promise<void> {
  const token = getTelegramBotToken();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not configured");

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: replyMarkup,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram sendMessage failed: ${res.status} ${body}`);
  }
}
