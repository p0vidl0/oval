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
} from "@/lib/admin/publication-form";
import { requireEditor } from "@/lib/admin/require-editor";
import {
  appendImagesFromForm,
  syncImagesFromForm,
} from "@/lib/admin/save-post-images";
import { db } from "@/lib/db/client";
import { feedPosts } from "@/lib/db/schema";
import { maxImagesForPostType } from "@/lib/feed/post-image-limits";
import { isPostLive, isPostScheduled } from "@/lib/feed/publication";
import {
  getAnnouncementForSession,
  getFeedPostById,
  getTrainingSessionById,
} from "@/lib/feed/queries";
import { publishFeedEvent } from "@/lib/realtime/feed-event-bus";

function revalidatePost(postId: string, sessionId: string | null) {
  revalidatePath("/feed");
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
  const session = await requireEditor();
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const pinned = formData.get("pinned") === "on";
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
  await db.transaction(async (tx) => {
    await tx.insert(feedPosts).values({
      id,
      type,
      title,
      body,
      ...state,
      authorUserId: session.user.id,
      relatedSessionId: sessionId,
      pinned,
    });
    await savePinnedForState(tx, id, pinned, state);
  });
  await appendImagesFromForm(id, formData, title, maxImagesForPostType(type));

  revalidatePost(id, sessionId);
  emitFeedPostLive(id, isPostLive(state), false);
  if (sessionId) {
    publishFeedEvent({ type: "session.changed", sessionId });
    redirect(`/admin/sessions/${sessionId}?tab=history`);
  }
  redirect(
    `/admin/posts/${id}?done=${isPostScheduled(state) ? "scheduled" : "created"}`,
  );
}

/** Текст, фото, закрепление и статус публикации. Тренировку не трогает. */
export async function updatePublication(formData: FormData) {
  await requireEditor();
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
      .set({ title, body, pinned, ...next })
      .where(eq(feedPosts.id, postId));
    await savePinnedForState(tx, postId, pinned, next);
  });

  await syncImagesFromForm(
    postId,
    formData,
    title,
    maxImagesForPostType(post.type),
  );

  revalidatePost(postId, post.relatedSessionId);
  const wasLive = isPostLive(post, now);
  const isLive = isPostLive(next, now);
  emitFeedPostLive(postId, isLive, wasLive);

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
