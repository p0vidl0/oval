import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";
import {
  markTelegramPublishSentAction,
  retryTelegramPublishAction,
} from "@/lib/admin/social-publish-actions";
import { getTelegramChannelId } from "@/lib/bots/telegram/channel-config";
import { telegramChannelMessageUrl } from "@/lib/bots/telegram/message-link";
import { readSocialPublishMaxRetries } from "@/lib/config/social-publish";
import {
  type SocialPublishJobRow,
  socialPublishOutcomeUnknown,
} from "@/lib/feed/social-publish-jobs";

const CONFIRM_RETRY = "Отправить публикацию в Telegram-канал ещё раз?";
const CONFIRM_RETRY_UNKNOWN =
  "Прошлая отправка прервалась, и неизвестно, дошла ли она. Пост мог уже появиться в канале — проверьте канал, иначе будет дубль. Отправить ещё раз?";
const CONFIRM_MARK_SENT =
  "Отметить публикацию как отправленную? Бот не будет отправлять её в канал.";

function statusText(
  job: SocialPublishJobRow,
  maxRetries: number,
  live: boolean,
): string {
  switch (job.status) {
    case "sent":
      return "Telegram: отправлено в канал.";
    case "sending":
      return "Telegram: отправляется…";
    case "pending":
      if (!live)
        return "Telegram: отправится, когда публикация выйдет в ленту.";
      return job.attemptCount > 0
        ? `Telegram: в очереди, попытка ${job.attemptCount + 1} из ${maxRetries}.`
        : "Telegram: в очереди на отправку.";
    case "failed":
      return socialPublishOutcomeUnknown(job, maxRetries)
        ? "Telegram: отправка прервалась, результат неизвестен — проверьте канал."
        : "Telegram: не отправлено, попытки исчерпаны.";
  }
}

/** Статус отправки в канал и действия админа после `failed`. */
export function TelegramPublishStatus({
  postId,
  job,
  live,
}: {
  postId: string;
  job: SocialPublishJobRow;
  /** Публикация в ленте: только тогда есть что отправлять повторно. */
  live: boolean;
}) {
  const maxRetries = readSocialPublishMaxRetries();
  const failed = job.status === "failed";
  const messageUrl =
    job.status === "sent"
      ? telegramChannelMessageUrl(getTelegramChannelId(), job.externalId)
      : null;

  return (
    <div className="nl-admin-callout" data-telegram-status={job.status}>
      <p className="caption">
        {statusText(job, maxRetries, live)}{" "}
        {messageUrl ? (
          <a href={messageUrl} target="_blank" rel="noopener noreferrer">
            Открыть сообщение
          </a>
        ) : null}
      </p>
      {job.lastError && job.status !== "sent" ? (
        <p className="caption nl-muted">Ошибка: {job.lastError}</p>
      ) : null}
      {failed ? (
        <div className="nl-admin-callout__actions">
          {live ? (
            <form action={retryTelegramPublishAction}>
              <input type="hidden" name="post_id" value={postId} />
              <ConfirmSubmitButton
                label="Отправить в Telegram ещё раз"
                pendingLabel="Ставим в очередь…"
                confirmMessage={
                  socialPublishOutcomeUnknown(job, maxRetries)
                    ? CONFIRM_RETRY_UNKNOWN
                    : CONFIRM_RETRY
                }
              />
            </form>
          ) : null}
          <form action={markTelegramPublishSentAction}>
            <input type="hidden" name="post_id" value={postId} />
            <ConfirmSubmitButton
              label="Пост уже в канале"
              pendingLabel="Сохраняем…"
              confirmMessage={CONFIRM_MARK_SENT}
            />
          </form>
        </div>
      ) : null}
    </div>
  );
}
