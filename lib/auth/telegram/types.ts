/** Verified Telegram user (Login Widget or bot message `from`). */
export type TelegramProfile = {
  id: number;
  firstName?: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
};

export type TelegramLoginIntentRecord = {
  status: "pending" | "ready";
  telegramId?: string;
  next?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
  chatId?: number;
};
