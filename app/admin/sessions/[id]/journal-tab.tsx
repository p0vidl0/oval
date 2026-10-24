import Link from "next/link";
import { Muted } from "@/components/nl/ui";
import { FEED_POST_TYPE_LABELS, type FeedPostType } from "@/lib/feed/types";
import { formatDateTimeRu } from "@/lib/format/datetime";
import {
  listSessionEvents,
  listSessionRegistrationEvents,
} from "@/lib/training/admin-queries";
import {
  describeRegistrationEvent,
  describeSessionEvent,
} from "./describe-events";

type JournalItem = {
  id: string;
  createdAt: Date;
  text: string;
  actorName: string | null;
  post: {
    id: string | null;
    type: FeedPostType | null;
    title: string | null;
  } | null;
};

/** События тренировки и записей одной лентой, от новых к старым. */
export async function JournalTab({ sessionId }: { sessionId: string }) {
  const [sessionEvents, registrationEvents] = await Promise.all([
    listSessionEvents(sessionId),
    listSessionRegistrationEvents(sessionId),
  ]);
  const events: JournalItem[] = [
    ...sessionEvents.map(({ event, actorName, post }) => ({
      id: event.id,
      createdAt: event.createdAt,
      text: describeSessionEvent(event.kind, event.payload ?? {}),
      actorName,
      post,
    })),
    ...registrationEvents.map(({ event, participant, actor }) => ({
      id: event.id,
      createdAt: event.createdAt,
      text: `${describeRegistrationEvent(event.kind, event.payload ?? {})}: ${
        participant.name?.trim() || participant.email || "без имени"
      }`,
      // Своё действие участника не подписываем вторым именем.
      actorName: actor?.id && actor.id !== participant.id ? actor.name : null,
      post: null,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return (
    <section>
      {events.length === 0 ? (
        <Muted as="p" className="caption">
          Событий пока нет.
        </Muted>
      ) : null}
      <ol className="nl-admin-timeline">
        {events.map(({ id, createdAt, text, actorName, post }) => (
          <li key={id}>
            <Muted className="nl-mono data-sm">
              {formatDateTimeRu(createdAt)}
            </Muted>
            <span>
              {text}
              {actorName ? <Muted> · {actorName}</Muted> : null}
            </span>
            {post?.id && post.type ? (
              <Link href={`/admin/posts/${post.id}`}>
                {FEED_POST_TYPE_LABELS[post.type]}: {post.title}
              </Link>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
