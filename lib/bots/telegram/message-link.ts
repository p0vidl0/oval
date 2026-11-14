/**
 * Ссылка на сообщение в канале: `@name` → t.me/name/id,
 * `-100…` (приватный) → t.me/c/…/id. Иначе null.
 */
export function telegramChannelMessageUrl(
  channelId: string | undefined,
  messageId: string | null,
): string | null {
  if (!channelId || !messageId || !/^\d+$/.test(messageId)) return null;
  const username = channelId.match(/^@([A-Za-z0-9_]{4,})$/)?.[1];
  if (username) return `https://t.me/${username}/${messageId}`;
  const internal = channelId.match(/^-100(\d+)$/)?.[1];
  if (internal) return `https://t.me/c/${internal}/${messageId}`;
  return null;
}
