"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { emitFeedPostLive } from "@/lib/admin/feed-live";
import { savePinnedForState } from "@/lib/admin/post-pinning";
import {
  initialPublicationState,
  nextPublicationState,
  PublicationError,
  type PublicationState,
  readPublishToTelegram,
} from "@/lib/admin/publication-form";
import { requireCapability } from "@/lib/admin/require-capability";
import {
  appendImagesFromForm,
  syncImagesFromForm,
} from "@/lib/admin/save-post-images";
import { db } from "@/lib/db/client";
import { feedPosts } from "@/lib/db/schema";
import { FEED_LIST_PATH } from "@/lib/feed/feed-list-path";
import { postPath } from "@/lib/feed/open-post-url";
import { maxImagesForPostType } from "@/lib/feed/post-image-limits";
import { isPostLive, isPostScheduled } from "@/lib/feed/publication";
import {
  getAnnouncementForSession,
  getFeedPostById,
  getTrainingSessionById,
} from "@/lib/feed/queries";
import { allocatePostSlug } from "@/lib/feed/slug";
import { scheduleSocialPublishAfter } from "@/lib/feed/social-publish";
import { ensureSocialPublishJobs } from "@/lib/feed/social-publish-jobs";
import { publishFeedEvent } from "@/lib/realtime/feed-event-bus";

function revalidatePost(
  postId: string,
  sessionId: string | null,
  slug: string,
) {
  revalidatePath(FEED_LIST_PATH);
  revalidatePath(postPath(slug));
  revalidatePath(`/feed/${postId}`);
  revalidatePath("/admin/posts");
  revalidatePath(`/admin/posts/${postId}`);
  if (sessionId) {
    revalidatePath("/admin/sessions");
    revalidatePath(`/admin/sessions/${sessionId}`);
  }
}

function withError(url: string, message: string) {
  return `${url}${url.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`;
}

/**
 * Публикации не удаляются: только «Снять с публикации» (`submit_action=unpublish`).
 * Отложенная публикация — `submit_action=schedule` + `publish_date` / `publish_time`.
 *
 * Новость или анонс к существующей тренировке (`session_id`).
 * Тренировку вместе с анонсом создаёт `createTrainingAction`.
 */
export async function createPublication(formData: FormData) {
  const session = await requireCapability("feed.publish");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const pinned = formData.get("pinned") === "on";
  const publishToTelegram = readPublishToTelegram(formData);
  const sessionId = String(formData.get("session_id") ?? "").trim() || null;
  const backUrl = sessionId
    ? `/admin/posts/new?session=${sessionId}`
    : "/admin/posts/new";
  if (!title) redirect(withError(backUrl, "Укажите заголовок"));

  let state: PublicationState;
  try {
    state = initialPublicationState(formData);
  } catch (error) {
    if (!(error instanceof PublicationError)) throw error;
    redirect(withError(backUrl, error.message));
  }

  if (sessionId) {
    if (!(await getTrainingSessionById(sessionId))) {
      throw new Error("Тренировка не найдена");
    }
    if (await getAnnouncementForSession(sessionId)) {
      throw new Error("У тренировки уже есть анонс");
    }
  }
  const type = sessionId ? "training_announcement" : "news";

  const id = crypto.randomUUID();
  const slugAt = state.publishedAt ?? new Date();
  let slug = "";
  await db.transaction(async (tx) => {
    slug = await allocatePostSlug(tx, slugAt);
    await tx.insert(feedPosts).values({
      id,
      slug,
      type,
      title,
      body,
      ...state,
      authorUserId: session.user.id,
      relatedSessionId: sessionId,
      pinned,
      publishToTelegram,
    });
    await savePinnedForState(tx, id, pinned, state);
  });
  await appendImagesFromForm(id, formData, title, maxImagesForPostType(type));
  await ensureSocialPublishJobs(id);

  revalidatePost(id, sessionId, slug);
  emitFeedPostLive(id, isPostLive(state), false);
  scheduleSocialPublishAfter(id, state);
  if (sessionId) {
    publishFeedEvent({ type: "session.changed", sessionId });
    redirect(`/admin/sessions/${sessionId}?tab=posts`);
  }
  redirect(
    `/admin/posts/${id}?done=${isPostScheduled(state) ? "scheduled" : "created"}`,
  );
}

/** Текст, фото, закрепление и статус публикации. Тренировку не трогает. */
export async function updatePublication(formData: FormData) {
  await requireCapability("feed.publish");
  const postId = String(formData.get("post_id") ?? "").trim();
  if (!postId) throw new Error("Не указана публикация");

  const post = await getFeedPostById(postId);
  if (!post) throw new Error("Публикация не найдена");
  const postUrl = `/admin/posts/${postId}`;

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!title) redirect(withError(postUrl, "Заголовок обязателен"));

  const now = new Date();
  let next: PublicationState;
  try {
    next = nextPublicationState(formData, post, now);
  } catch (error) {
    if (!(error instanceof PublicationError)) throw error;
    redirect(withError(postUrl, error.message));
  }
  const pinned = next.status === "published" && formData.get("pinned") === "on";

  await db.transaction(async (tx) => {
    await tx
      .update(feedPosts)
      .set({
        title,
        body,
        pinned,
        status: next.status,
        publishedAt: next.publishedAt,
        unpublishedAt: next.unpublishedAt,
      })
      .where(eq(feedPosts.id, postId));
    await savePinnedForState(tx, postId, pinned, next);
  });

  await syncImagesFromForm(
    postId,
    formData,
    title,
    maxImagesForPostType(post.type),
  );

  revalidatePost(postId, post.relatedSessionId, post.slug);
  const wasLive = isPostLive(post, now);
  const isLive = isPostLive(next, now);
  emitFeedPostLive(postId, isLive, wasLive);
  scheduleSocialPublishAfter(postId, next);

  const rescheduled =
    isPostScheduled(next, now) &&
    next.publishedAt?.getTime() !== post.publishedAt?.getTime();
  const done = rescheduled
    ? "scheduled"
    : isLive && !wasLive
      ? "published"
      : !isLive && wasLive
        ? "unpublished"
        : next.status === "draft" && post.status === "published"
          ? "unscheduled"
          : "saved";
  redirect(`${postUrl}?done=${done}`);
}
