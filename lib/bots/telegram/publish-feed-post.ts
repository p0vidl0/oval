import { eq } from "drizzle-orm";
import {
  sendTelegramMediaGroup,
  sendTelegramMessage,
  sendTelegramPhoto,
} from "@/lib/bots/telegram/api";
import {
  getTelegramChannelId,
  isTelegramChannelPublishConfigured,
} from "@/lib/bots/telegram/channel-config";
import {
  formatFeedPostTelegramHtml,
  formatTrainingAnnouncementTelegramHtml,
} from "@/lib/bots/telegram/format-message";
import { db } from "@/lib/db/client";
import { feedPosts } from "@/lib/db/schema";
import { listImagesForPost } from "@/lib/feed/post-images";
import { isPostLive } from "@/lib/feed/publication";
import { getFeedPostById, getTrainingSessionForPost } from "@/lib/feed/queries";
import type { FeedPostMeta, FeedPostType } from "@/lib/feed/types";
import {
  buildMiniAppStartParamPost,
  buildTelegramMiniAppLink,
} from "@/lib/telegram/mini-app-start-param";
import { uploadPublicUrl } from "@/lib/uploads/storage";

function publicSiteOrigin(): string {
  const raw = process.env.BETTER_AUTH_URL?.trim().replace(/\/$/, "");
  return raw ?? "";
}

function absoluteUploadUrl(storageKey: string): string | null {
  const origin = publicSiteOrigin();
  if (!origin) return null;
  return `${origin}${uploadPublicUrl(storageKey)}`;
}

function openPostUrl(postId: string): string {
  const miniApp = buildTelegramMiniAppLink(buildMiniAppStartParamPost(postId));
  if (miniApp) return miniApp;
  const origin = publicSiteOrigin();
  return origin ? `${origin}/feed/${postId}` : `/feed/${postId}`;
}

function buttonLabel(type: FeedPostType): string {
  return type === "training_announcement" ? "Записаться" : "Открыть";
}

function postButtonMarkup(postId: string, type: FeedPostType) {
  const url = openPostUrl(postId);
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

async function resolvePhotoUrls(postId: string): Promise<string[]> {
  const images = await listImagesForPost(postId);
  const urls: string[] = [];
  for (const img of images) {
    const url = absoluteUploadUrl(img.storageKey);
    if (url) urls.push(url);
  }
  return urls;
}

async function sendChannelPost(
  channelId: string,
  postId: string,
  type: FeedPostType,
  caption: string,
  photoUrls: string[],
): Promise<number> {
  const keyboard = postButtonMarkup(postId, type);
  const parseMode = "HTML" as const;

  if (photoUrls.length === 0) {
    const { messageId } = await sendTelegramMessage(channelId, caption, {
      parse_mode: parseMode,
      inline_keyboard: keyboard,
    });
    return messageId;
  }

  if (photoUrls.length === 1) {
    const { messageId } = await sendTelegramPhoto(
      channelId,
      photoUrls[0] as string,
      caption,
      { parse_mode: parseMode, inline_keyboard: keyboard },
    );
    return messageId;
  }

  const { messageIds } = await sendTelegramMediaGroup(
    channelId,
    photoUrls,
    caption,
    { parse_mode: parseMode },
  );
  await sendTelegramMessage(channelId, `${buttonLabel(type)} →`, {
    inline_keyboard: keyboard,
  });
  return messageIds[0] as number;
}

export async function publishFeedPostToTelegramChannel(
  postId: string,
): Promise<void> {
  if (!isTelegramChannelPublishConfigured()) return;

  const post = await getFeedPostById(postId);
  if (!post?.publishToTelegram || !isPostLive(post)) return;

  const meta = (post.meta ?? {}) as FeedPostMeta;
  if (meta.telegramChannelMessageId != null) return;

  const channelId = getTelegramChannelId();
  if (!channelId) return;

  const caption = await buildTelegramCaption(post);
  const photoUrls = await resolvePhotoUrls(postId);
  if (photoUrls.length > 0 && !publicSiteOrigin()) {
    console.warn(
      "[telegram-channel-publish]",
      postId,
      "BETTER_AUTH_URL not set — skip photos",
    );
  }

  const urlsForSend =
    photoUrls.length > 0 && publicSiteOrigin() ? photoUrls : [];

  const messageId = await sendChannelPost(
    channelId,
    post.id,
    post.type,
    caption,
    urlsForSend,
  );

  const nextMeta: FeedPostMeta = {
    ...meta,
    telegramChannelMessageId: messageId,
  };
  await db
    .update(feedPosts)
    .set({ meta: nextMeta })
    .where(eq(feedPosts.id, postId));
}

/** Не прерывает сохранение публикации при ошибке Telegram API. */
export async function tryPublishFeedPostToTelegramChannel(
  postId: string,
): Promise<void> {
  try {
    await publishFeedPostToTelegramChannel(postId);
  } catch (error) {
    console.error("[telegram-channel-publish]", postId, error);
  }
}
