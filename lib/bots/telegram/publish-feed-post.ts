import { withSocialPublishGuard } from "@/lib/bots/social-publish/guard";
import {
  isTelegramOutcomeUnknown,
  sendTelegramMediaGroupUpload,
  sendTelegramMessage,
  sendTelegramPhotoUpload,
} from "@/lib/bots/telegram/api";
import {
  getTelegramChannelId,
  isTelegramChannelPublishConfigured,
} from "@/lib/bots/telegram/channel-config";
import {
  formatFeedPostTelegramHtml,
  formatTrainingAnnouncementTelegramHtml,
} from "@/lib/bots/telegram/format-message";
import { publicFeedPostUrl } from "@/lib/feed/open-post-url";
import { listImagesForPost } from "@/lib/feed/post-images";
import { isPostLive } from "@/lib/feed/publication";
import { getFeedPostById, getTrainingSessionForPost } from "@/lib/feed/queries";
import {
  claimSocialPublishJob,
  getSocialPublishJob,
  jobReadyToSend,
  markSocialPublishOutcomeUnknown,
  markSocialPublishSent,
  recordSocialPublishFailure,
  type SocialPublishClaim,
  touchSocialPublishClaim,
} from "@/lib/feed/social-publish-jobs";
import type { FeedPostType } from "@/lib/feed/types";
import { log } from "@/lib/log";
import {
  buildMiniAppStartParamPost,
  buildTelegramMiniAppLink,
} from "@/lib/telegram/mini-app-start-param";
import { type PostUploadFile, readPostUploadFile } from "@/lib/uploads/storage";

function openPostUrl(postId: string, slug: string, type: FeedPostType): string {
  const miniApp = buildTelegramMiniAppLink(buildMiniAppStartParamPost(postId));
  if (miniApp) return miniApp;
  return publicFeedPostUrl(slug, type);
}

function buttonLabel(type: FeedPostType): string {
  return type === "training_announcement" ? "Записаться" : "Открыть";
}

function postButtonMarkup(postId: string, slug: string, type: FeedPostType) {
  const url = openPostUrl(postId, slug, type);
  return [[{ text: buttonLabel(type), url }]];
}

async function buildTelegramCaption(
  post: NonNullable<Awaited<ReturnType<typeof getFeedPostById>>>,
): Promise<string> {
  if (post.type === "training_announcement") {
    const training = await getTrainingSessionForPost(post);
    if (training) {
      const text = post.body.trim() || post.title.trim();
      return formatTrainingAnnouncementTelegramHtml(training.startsAt, text);
    }
  }
  return formatFeedPostTelegramHtml(post.title, post.body);
}

async function resolvePhotoUploads(postId: string): Promise<PostUploadFile[]> {
  const images = await listImagesForPost(postId);
  const files: PostUploadFile[] = [];
  for (const img of images) {
    const file = await readPostUploadFile(img.storageKey);
    if (file) files.push(file);
  }
  return files;
}

async function sendChannelPost(
  channelId: string,
  postId: string,
  slug: string,
  type: FeedPostType,
  caption: string,
  photos: PostUploadFile[],
): Promise<number> {
  const keyboard = postButtonMarkup(postId, slug, type);
  const parseMode = "HTML" as const;

  if (photos.length === 0) {
    const { messageId } = await sendTelegramMessage(channelId, caption, {
      parse_mode: parseMode,
      inline_keyboard: keyboard,
    });
    return messageId;
  }

  if (photos.length === 1) {
    const { messageId } = await sendTelegramPhotoUpload(
      channelId,
      photos[0] as PostUploadFile,
      caption,
      { parse_mode: parseMode, inline_keyboard: keyboard },
    );
    return messageId;
  }

  const { messageIds } = await sendTelegramMediaGroupUpload(
    channelId,
    photos,
    caption,
    { parse_mode: parseMode },
  );
  // Альбом уже в канале: сбой кнопки не должен вести к повтору всего поста.
  try {
    await sendTelegramMessage(channelId, `${buttonLabel(type)} →`, {
      inline_keyboard: keyboard,
    });
  } catch (error) {
    log("error", "telegram_publish_button_failed", { postId, error });
  }
  return messageIds[0] as number;
}

const CLAIM_HEARTBEAT_MS = 30_000;

/** Что успело произойти до исключения — от этого зависит, можно ли повторять. */
type PublishSlot = {
  claim: SocialPublishClaim | null;
  /** Telegram принял пост; дальше строка не возвращается в `pending`. */
  messageId: number | null;
};

/** Пока upload идёт, догон не считает claim брошенным. */
function keepClaimAlive(claim: SocialPublishClaim): () => void {
  const timer = setInterval(() => {
    void touchSocialPublishClaim(claim).catch((error) => {
      log("error", "telegram_publish_claim_heartbeat", {
        jobId: claim.jobId,
        error,
      });
    });
  }, CLAIM_HEARTBEAT_MS);
  timer.unref?.();
  return () => clearInterval(timer);
}

export async function publishFeedPostToTelegramChannel(
  postId: string,
  slot: PublishSlot = { claim: null, messageId: null },
): Promise<void> {
  if (!isTelegramChannelPublishConfigured()) return;

  const channelId = getTelegramChannelId();
  if (!channelId) return;

  await withSocialPublishGuard(
    "telegram",
    postId,
    async () => {
      const job = await getSocialPublishJob(postId, "telegram");
      if (!job || !jobReadyToSend(job)) return false;
      const post = await getFeedPostById(postId);
      if (!post?.publishToTelegram || !isPostLive(post)) return false;
      return true;
    },
    async () => {
      const job = await getSocialPublishJob(postId, "telegram");
      if (!job || !jobReadyToSend(job)) return;

      const post = await getFeedPostById(postId);
      if (!post?.publishToTelegram || !isPostLive(post)) return;

      const claim = await claimSocialPublishJob(job.id);
      if (!claim) return;
      slot.claim = claim;
      const stopHeartbeat = keepClaimAlive(claim);
      try {
        const caption = await buildTelegramCaption(post);
        const photos = await resolvePhotoUploads(postId);

        log("info", "telegram_publish_start", { postId: post.id });

        const messageId = await sendChannelPost(
          channelId,
          post.id,
          post.slug,
          post.type,
          caption,
          photos,
        );
        slot.messageId = messageId;

        const marked = await markSocialPublishSent(claim, messageId);
        if (!marked) {
          log("error", "telegram_publish_mark_missed", {
            postId: post.id,
            messageId,
          });
        }
        log("info", "telegram_publish_done", {
          postId: post.id,
          ok: true,
          messageId,
        });
      } finally {
        stopHeartbeat();
      }
    },
  );
}

async function settleFailedPublish(
  postId: string,
  slot: PublishSlot,
  error: unknown,
): Promise<void> {
  const { claim, messageId } = slot;
  if (claim && messageId != null) {
    // Пост уже в канале. Не удалось только записать `sent` — повторяем запись,
    // при неудаче строка останется `sending` и догон переведёт её в `failed`.
    const marked = await markSocialPublishSent(claim, messageId);
    log(marked ? "info" : "error", "telegram_publish_mark_retry", {
      postId,
      messageId,
      marked,
      error,
    });
    return;
  }
  if (claim && isTelegramOutcomeUnknown(error)) {
    await markSocialPublishOutcomeUnknown(claim, error);
  } else if (claim) {
    await recordSocialPublishFailure(claim.jobId, error, claim.token);
  } else {
    const job = await getSocialPublishJob(postId, "telegram");
    if (job?.status === "pending") {
      await recordSocialPublishFailure(job.id, error);
    }
  }
  log("error", "telegram_publish_done", { postId, ok: false, error });
}

/** Не прерывает сохранение публикации при ошибке Telegram API. */
export async function tryPublishFeedPostToTelegramChannel(
  postId: string,
): Promise<void> {
  const slot: PublishSlot = { claim: null, messageId: null };
  try {
    await publishFeedPostToTelegramChannel(postId, slot);
  } catch (error) {
    try {
      await settleFailedPublish(postId, slot, error);
    } catch (settleError) {
      log("error", "telegram_publish_settle_failed", {
        postId,
        error,
        settleError,
      });
    }
  }
}
