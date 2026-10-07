"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { emitFeedPostLive } from "@/lib/admin/feed-live";
import {
  initialPublicationState,
  PublicationError,
} from "@/lib/admin/publication-form";
import { requireEditor } from "@/lib/admin/require-editor";
import { appendImagesFromForm } from "@/lib/admin/save-post-images";
import {
  readChangePostFromForm,
  readOptionalScheduleFromForm,
  readRequiredScheduleFromForm,
  readTrainingSettingsFromForm,
} from "@/lib/admin/training-form";
import { maxImagesForPostType } from "@/lib/feed/post-image-limits";
import { isPostLive } from "@/lib/feed/publication";
import { publishFeedEvent } from "@/lib/realtime/feed-event-bus";
import { publishSessionRegistrationsChanged } from "@/lib/realtime/publish-session-registrations-changed";
import {
  cancelTrainingSession,
  createTrainingSession,
  refundAllPaid,
  rescheduleTrainingSession,
  TrainingServiceError,
  transferAllPaid,
  updateTrainingSettings,
} from "@/lib/training/session-service";

function sessionUrl(sessionId: string, params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  return `/admin/sessions/${sessionId}${qs ? `?${qs}` : ""}`;
}

/** Ошибку домена показываем на странице, а не экраном ошибки. */
async function runThenRedirect(
  run: () => Promise<string>,
  onError: (message: string) => string,
): Promise<never> {
  let target: string;
  try {
    target = await run();
  } catch (error) {
    if (
      !(error instanceof TrainingServiceError) &&
      !(error instanceof PublicationError)
    ) {
      throw error;
    }
    target = onError(error.message);
  }
  redirect(target);
}

function revalidateTraining(sessionId: string) {
  revalidatePath("/admin/sessions");
  revalidatePath(`/admin/sessions/${sessionId}`);
  revalidatePath("/admin/posts");
  revalidatePath("/admin/registrations");
  revalidatePath("/admin/payments");
  revalidatePath("/feed");
  revalidatePath("/cabinet");
}

export async function createTrainingAction(formData: FormData) {
  const session = await requireEditor();
  const withAnnouncement = formData.get("create_announcement") === "on";

  await runThenRedirect(
    async () => {
      const publication = withAnnouncement
        ? initialPublicationState(formData)
        : null;
      const result = await createTrainingSession({
        settings: readTrainingSettingsFromForm(formData),
        schedule: readRequiredScheduleFromForm(formData),
        announcement: withAnnouncement
          ? {
              title: String(formData.get("title") ?? ""),
              body: String(formData.get("body") ?? "").trim(),
              publishedAt: publication?.publishedAt ?? null,
              pinned: formData.get("pinned") === "on",
            }
          : null,
        actorUserId: session.user.id,
      });
      if (result.announcementPostId) {
        await appendImagesFromForm(
          result.announcementPostId,
          formData,
          String(formData.get("title") ?? ""),
          maxImagesForPostType("training_announcement"),
        );
        emitFeedPostLive(
          result.announcementPostId,
          publication ? isPostLive(publication) : false,
          false,
        );
      }
      revalidateTraining(result.sessionId);
      return sessionUrl(result.sessionId, { done: "created" });
    },
    (message) => `/admin/sessions/new?error=${encodeURIComponent(message)}`,
  );
}

export async function updateTrainingSettingsAction(formData: FormData) {
  const session = await requireEditor();
  const sessionId = String(formData.get("session_id") ?? "");

  await runThenRedirect(
    async () => {
      await updateTrainingSettings({
        sessionId,
        settings: readTrainingSettingsFromForm(formData),
        schedule: readOptionalScheduleFromForm(formData),
        actorUserId: session.user.id,
      });
      revalidateTraining(sessionId);
      publishFeedEvent({ type: "session.changed", sessionId });
      return sessionUrl(sessionId, { tab: "settings", done: "saved" });
    },
    (message) => sessionUrl(sessionId, { tab: "settings", error: message }),
  );
}

export async function rescheduleTrainingAction(formData: FormData) {
  const session = await requireEditor();
  const sessionId = String(formData.get("session_id") ?? "");

  await runThenRedirect(
    async () => {
      const post = readChangePostFromForm(formData, "Перенос тренировки");
      const { postId } = await rescheduleTrainingSession({
        sessionId,
        schedule: readRequiredScheduleFromForm(formData),
        post,
        actorUserId: session.user.id,
      });
      revalidateTraining(sessionId);
      if (postId) {
        emitFeedPostLive(postId, post.mode === "publish", false);
      }
      publishFeedEvent({ type: "session.changed", sessionId });
      return sessionUrl(sessionId, {
        done: "rescheduled",
        ...(postId ? { post: postId } : {}),
      });
    },
    (message) => sessionUrl(sessionId, { error: message }),
  );
}

export async function cancelTrainingAction(formData: FormData) {
  const session = await requireEditor();
  const sessionId = String(formData.get("session_id") ?? "");

  await runThenRedirect(
    async () => {
      const post = readChangePostFromForm(formData, "Тренировка отменена");
      const { postId } = await cancelTrainingSession({
        sessionId,
        reason: String(formData.get("cancellation_reason") ?? ""),
        post,
        actorUserId: session.user.id,
      });
      revalidateTraining(sessionId);
      if (postId) {
        emitFeedPostLive(postId, post.mode === "publish", false);
      }
      publishFeedEvent({ type: "session.changed", sessionId });
      await publishSessionRegistrationsChanged(sessionId);
      return sessionUrl(sessionId, {
        filter: "paid",
        done: "cancelled",
        ...(postId ? { post: postId } : {}),
      });
    },
    (message) => sessionUrl(sessionId, { error: message }),
  );
}

export async function refundAllPaidAction(formData: FormData) {
  const session = await requireEditor();
  const sessionId = String(formData.get("session_id") ?? "");

  await runThenRedirect(
    async () => {
      const { count } = await refundAllPaid({
        sessionId,
        actorUserId: session.user.id,
      });
      revalidateTraining(sessionId);
      return sessionUrl(sessionId, {
        filter: "closed",
        done: "refunded",
        count: String(count),
      });
    },
    (message) => sessionUrl(sessionId, { filter: "paid", error: message }),
  );
}

export async function transferAllPaidAction(formData: FormData) {
  await requireEditor();
  const sessionId = String(formData.get("session_id") ?? "");
  const targetSessionId = String(formData.get("target_session_id") ?? "");

  await runThenRedirect(
    async () => {
      const { count } = await transferAllPaid({ sessionId, targetSessionId });
      revalidateTraining(sessionId);
      revalidateTraining(targetSessionId);
      await publishSessionRegistrationsChanged(targetSessionId);
      return sessionUrl(sessionId, {
        filter: "closed",
        done: "transferred",
        count: String(count),
      });
    },
    (message) => sessionUrl(sessionId, { filter: "paid", error: message }),
  );
}
