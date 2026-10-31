import Link from "next/link";
import { NlDateStack } from "@/components/nl/date-stack";
import { postPath } from "@/lib/feed/open-post-url";
import {
  getPublishedFeedPostById,
  getPublishedFeedPostBySlug,
  getTrainingSessionForPost,
} from "@/lib/feed/queries";
import { isLikelyPostSlug } from "@/lib/feed/slug";
import { formatTimeHm } from "@/lib/format/datetime";

type Props = { next?: string };

const POST_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function publishedAnnouncementFromNext(next: string | undefined) {
  if (!next?.startsWith("/")) return null;

  const legacy = next.match(/^\/feed\/([^/?]+)/);
  const legacySegment = legacy?.[1];
  if (legacySegment) {
    const post = POST_ID_RE.test(legacySegment)
      ? await getPublishedFeedPostById(legacySegment)
      : isLikelyPostSlug(legacySegment)
        ? await getPublishedFeedPostBySlug(legacySegment)
        : null;
    if (post?.type === "training_announcement") return post;
  }

  const root = next.match(
    /^\/(?:sessions\/)?(\d{4}-\d{2}-\d{2}(?:-\d+)?)(?:\?|$)/,
  );
  const slug = root?.[1];
  if (slug && isLikelyPostSlug(slug)) {
    const post = await getPublishedFeedPostBySlug(slug);
    if (post?.type === "training_announcement") return post;
  }

  return null;
}

export async function LoginNextPreview({ next }: Props) {
  const post = await publishedAnnouncementFromNext(next);
  if (!post) return null;

  const training = await getTrainingSessionForPost(post);
  if (!training) return null;

  return (
    <Link
      href={postPath(post.slug, post.type)}
      className="nl-card nl-login-next-preview"
      style={{
        display: "flex",
        // .nl-card по умолчанию — колонка; здесь дата и название в одной строке.
        flexDirection: "row",
        alignItems: "center",
        gap: "var(--space-4)",
        marginTop: "var(--space-6)",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <NlDateStack date={training.startsAt} size="sm" />
      <div>
        <p className="nl-display" style={{ margin: 0 }}>
          {post.title}
        </p>
        <p
          className="caption nl-mono"
          style={{ margin: 0, color: "var(--ink-muted)" }}
        >
          {formatTimeHm(training.startsAt)}
        </p>
      </div>
    </Link>
  );
}
