import Link from "next/link";
import { PostStatusBadge } from "@/components/admin/admin-badges";
import { Muted } from "@/components/nl/ui";
import { listPostsForSession } from "@/lib/feed/queries";
import { FEED_POST_TYPE_LABELS } from "@/lib/feed/types";
import { formatDateTimeRu } from "@/lib/format/datetime";

/** Анонс, переносы и отмена тренировки — посты в ленте. */
export async function PostsTab({ sessionId }: { sessionId: string }) {
  const posts = await listPostsForSession(sessionId);
  const now = new Date();
  if (posts.length === 0) {
    return (
      <Muted as="p" className="caption">
        Публикаций нет.
      </Muted>
    );
  }
  return (
    <ul className="nl-admin-timeline">
      {posts.map((p) => (
        <li key={p.id}>
          <Muted className="nl-mono data-sm">
            {formatDateTimeRu(p.publishedAt ?? p.createdAt)}
          </Muted>
          <Link href={`/admin/posts/${p.id}`}>
            {FEED_POST_TYPE_LABELS[p.type]}: {p.title}
          </Link>
          <PostStatusBadge
            status={p.status}
            publishedAt={p.publishedAt}
            now={now}
          />
        </li>
      ))}
    </ul>
  );
}
