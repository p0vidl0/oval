import { eq } from "drizzle-orm";
import {
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
import { type PostUploadFile, readPostUploadFile } from "@/lib/uploads/storage";

function publicSiteOrigin(): string {
  const raw = process.env.BETTER_AUTH_URL?.trim().replace(/\/$/, "");
  return raw ?? "";
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
  type: FeedPostType,
  caption: string,
  photos: PostUploadFile[],
): Promise<number> {
  const keyboard = postButtonMarkup(postId, type);
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
  const photos = await resolvePhotoUploads(postId);

  const messageId = await sendChannelPost(
    channelId,
    post.id,
    post.type,
    caption,
    photos,
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
