import { getServerSession } from "@/lib/auth/session";
import type { FeedLiveCard } from "@/lib/feed/feed-live-card";
import {
  buildFeedLiveCard,
  changePostUserNote,
  formatTimeChangeFromMeta,
} from "@/lib/feed/feed-live-card";
import { listImagesForPost } from "@/lib/feed/post-images";
import {
  getLiveAnnouncementIdsBySession,
  getPublishedFeedPostById,
  getTrainingSessionForPost,
} from "@/lib/feed/queries";
import type { FeedPostMeta } from "@/lib/feed/types";
import {
  countActiveRegistrations,
  getUserRegistrationAnyStatus,
  getUserRegistrationForSession,
} from "@/lib/training/registrations";
import { uploadPublicUrl } from "@/lib/uploads/storage";

export async function loadFeedLiveCardForPost(
  postId: string,
): Promise<FeedLiveCard | null> {
  const post = await getPublishedFeedPostById(postId);
  if (!post) return null;

  const session = await getServerSession();
  const training = await getTrainingSessionForPost(post);

  let activeCount = 0;
  if (training) {
    activeCount = await countActiveRegistrations(training.id);
  }

  const userReg =
    session && training
      ? await getUserRegistrationForSession(session.user.id, training.id)
      : null;

  const images = await listImagesForPost(post.id);
  const gallery = images.map((img) => ({
    src: uploadPublicUrl(img.storageKey),
    alt: img.alt,
  }));

  const meta = (post.meta ?? {}) as FeedPostMeta;
  const eventDate =
    post.type === "race" && meta.eventStartsAt
      ? new Date(meta.eventStartsAt)
      : null;
  const timeChange = formatTimeChangeFromMeta(
    post.type,
    meta,
    training?.startsAt,
  );

  return buildFeedLiveCard({
    post,
    training: training ?? null,
    activeCount,
    gallery,
    imageCount: images.length,
    timeChange,
    eventDate,
    isLoggedIn: Boolean(session),
    userRegistration:
      userReg &&
      (userReg.status === "paid" || userReg.status === "pending_payment")
        ? { id: userReg.id, status: userReg.status }
        : null,
    announcementPostId: training
      ? (await getLiveAnnouncementIdsBySession([training.id])).get(training.id)
      : null,
    userNote:
      session && training && post.type !== "training_announcement"
        ? changePostUserNote(
            post.type,
            await getUserRegistrationAnyStatus(session.user.id, training.id),
          )
        : undefined,
  });
}
