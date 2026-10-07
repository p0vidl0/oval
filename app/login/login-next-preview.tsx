import Link from "next/link";
import { NlDateStack } from "@/components/nl/date-stack";
import {
  getPublishedFeedPostById,
  getTrainingSessionForPost,
} from "@/lib/feed/queries";
import { formatTimeHm } from "@/lib/format/datetime";

type Props = { next?: string };

function feedPostIdFromNext(next: string | undefined): string | null {
  if (!next) return null;
  const match = next.match(/^\/feed\/([^/?]+)/);
  return match?.[1] ?? null;
}

export async function LoginNextPreview({ next }: Props) {
  const postId = feedPostIdFromNext(next);
  if (!postId) return null;

  const post = await getPublishedFeedPostById(postId);
  if (!post || post.type !== "training_announcement") return null;

  const training = await getTrainingSessionForPost(post);
  if (!training) return null;

  return (
    <Link
      href={`/feed/${post.id}`}
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
      <div style={{ minWidth: 0 }}>
        <p className="caption" style={{ color: "var(--ink-muted)" }}>
          {formatTimeHm(training.startsAt)}
        </p>
        <p
          className="nl-display"
          style={{
            fontSize: 22,
            lineHeight: 1,
            overflowWrap: "anywhere",
            hyphens: "auto",
          }}
        >
          {post.title}
        </p>
      </div>
    </Link>
  );
}
