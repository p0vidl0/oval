const DEFAULT_TELEGRAM_API_ROOT = "https://api.telegram.org";

/** Базовый URL Bot API (reverse proxy). Без слэша в конце. */
export function getTelegramApiRoot(): string {
  const raw = process.env.TELEGRAM_API_ROOT?.trim();
  if (!raw) return DEFAULT_TELEGRAM_API_ROOT;
  return raw.replace(/\/$/, "");
}

/** `https://api.telegram.org/bot<token>/sendMessage` или через прокси. */
export function telegramBotMethodUrl(token: string, method: string): string {
  return `${getTelegramApiRoot()}/bot${token}/${method}`;
}
