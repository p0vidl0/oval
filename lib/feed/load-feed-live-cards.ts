import { getServerSession } from "@/lib/auth/session";
import type { FeedLiveCard } from "@/lib/feed/feed-live-card";
import {
  buildFeedLiveCard,
  changePostUserNote,
  formatTimeChangeFromMeta,
} from "@/lib/feed/feed-live-card";
import type { FeedFilterKey } from "@/lib/feed/filter";
import { typesForFilter } from "@/lib/feed/filter";
import { listImagesForPosts } from "@/lib/feed/post-images";
import {
  getLiveAnnouncementIdsBySession,
  getSessionsByIds,
  listPublishedFeedPosts,
} from "@/lib/feed/queries";
import type { FeedPostMeta } from "@/lib/feed/types";
import {
  countActiveRegistrations,
  getUserRegistrationAnyStatus,
  getUserRegistrationForSession,
} from "@/lib/training/registrations";
import { uploadPublicUrl } from "@/lib/uploads/storage";

export async function loadFeedLiveCards(
  filter: FeedFilterKey = "all",
): Promise<FeedLiveCard[]> {
  const types = typesForFilter(filter);
  const posts = await listPublishedFeedPosts(types ? { types } : undefined);
  const session = await getServerSession();
  const postIds = posts.map((p) => p.id);
  const sessions = await getSessionsByIds(
    posts.flatMap((p) => (p.relatedSessionId ? [p.relatedSessionId] : [])),
  );
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const announcementBySession = await getLiveAnnouncementIdsBySession(
    sessions.map((s) => s.id),
  );

  const images = await listImagesForPosts(postIds);
  const imagesByPost = new Map<string, typeof images>();
  for (const img of images) {
    const list = imagesByPost.get(img.postId) ?? [];
    list.push(img);
    imagesByPost.set(img.postId, list);
  }

  return Promise.all(
    posts.map(async (post) => {
      const training = post.relatedSessionId
        ? (sessionById.get(post.relatedSessionId) ?? null)
        : null;
      let activeCount = 0;
      if (training) {
        activeCount = await countActiveRegistrations(training.id);
      }
      const userReg =
        session && training
          ? await getUserRegistrationForSession(session.user.id, training.id)
          : null;
      const postImages = imagesByPost.get(post.id) ?? [];
      const gallery = postImages.map((img) => ({
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
        training,
        activeCount,
        gallery,
        imageCount: postImages.length,
        timeChange,
        eventDate,
        isLoggedIn: Boolean(session),
        userRegistration:
          userReg &&
          (userReg.status === "paid" || userReg.status === "pending_payment")
            ? { id: userReg.id, status: userReg.status }
            : null,
        announcementPostId: training
          ? announcementBySession.get(training.id)
          : null,
        userNote:
          session && training && post.type !== "training_announcement"
            ? changePostUserNote(
                post.type,
                await getUserRegistrationAnyStatus(
                  session.user.id,
                  training.id,
                ),
              )
            : undefined,
      });
    }),
  );
}
