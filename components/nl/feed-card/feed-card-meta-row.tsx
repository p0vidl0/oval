import { CardMetaWhen } from "@/components/nl/feed-card/feed-card-meta";
import {
  feedCardTagClass,
  feedCardTagLabel,
} from "@/components/nl/feed-card/tag";
import type { FeedPostType } from "@/lib/feed/types";

export function FeedCardMetaRow({
  type,
  pinned,
  publishedAt,
  userBadge,
  metaExtra,
  totalPhotos,
}: {
  type: FeedPostType;
  pinned?: boolean;
  publishedAt: Date;
  userBadge?: string;
  metaExtra?: string;
  totalPhotos: number;
}) {
  return (
    <div className="nl-card__meta">
      <span className={feedCardTagClass(type, pinned)}>
        {feedCardTagLabel(type, pinned)}
      </span>
      {userBadge ? <span>{userBadge}</span> : null}
      <span>
        <CardMetaWhen pinned={pinned} publishedAt={publishedAt} />
      </span>
      {totalPhotos > 1 ? <span>{totalPhotos} фото</span> : null}
      {metaExtra ? <span>{metaExtra}</span> : null}
    </div>
  );
}
