"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCapability } from "@/lib/admin/require-capability";
import { isTelegramChannelPublishConfigured } from "@/lib/bots/telegram/channel-config";
import { isPostLive } from "@/lib/feed/publication";
import { getFeedPostById } from "@/lib/feed/queries";
import { scheduleSocialPublishAfter } from "@/lib/feed/social-publish";
import {
  markFailedSocialPublishSent,
  requeueFailedSocialPublish,
} from "@/lib/feed/social-publish-jobs";

function postUrl(postId: string, query: string): string {
  return `/admin/posts/${postId}?${query}`;
}

function errorUrl(postId: string, message: string): string {
  return postUrl(postId, `error=${encodeURIComponent(message)}`);
}

function revalidate(postId: string, sessionId: string | null) {
  revalidatePath(`/admin/posts/${postId}`);
  if (sessionId) revalidatePath(`/admin/sessions/${sessionId}`);
}

/** Повторить отправку в канал после `failed`. Подтверждение — на кнопке. */
export async function retryTelegramPublishAction(formData: FormData) {
  await requireCapability("feed.publish");
  const postId = String(formData.get("post_id") ?? "").trim();
  if (!postId) throw new Error("Не указана публикация");
  const post = await getFeedPostById(postId);
  if (!post) throw new Error("Публикация не найдена");

  if (!isTelegramChannelPublishConfigured()) {
    redirect(errorUrl(postId, "Telegram-канал не настроен на сервере."));
  }
  if (!post.publishToTelegram) {
    redirect(
      errorUrl(postId, "Для этой публикации отправка в Telegram выключена."),
    );
  }
  if (!isPostLive(post)) {
    redirect(errorUrl(postId, "Публикация не в ленте — отправлять нечего."));
  }
  if (!(await requeueFailedSocialPublish(postId, "telegram"))) {
    redirect(
      errorUrl(postId, "Статус отправки уже изменился — обновите страницу."),
    );
  }

  scheduleSocialPublishAfter(postId, post);
  revalidate(postId, post.relatedSessionId);
  redirect(postUrl(postId, "done=telegram_requeued"));
}

/** Админ проверил канал: пост там есть — снять ошибку без отправки. */
export async function markTelegramPublishSentAction(formData: FormData) {
  await requireCapability("feed.publish");
  const postId = String(formData.get("post_id") ?? "").trim();
  if (!postId) throw new Error("Не указана публикация");
  const post = await getFeedPostById(postId);
  if (!post) throw new Error("Публикация не найдена");

  if (!(await markFailedSocialPublishSent(postId, "telegram"))) {
    redirect(
      errorUrl(postId, "Статус отправки уже изменился — обновите страницу."),
    );
  }

  revalidate(postId, post.relatedSessionId);
  redirect(postUrl(postId, "done=telegram_marked_sent"));
}
