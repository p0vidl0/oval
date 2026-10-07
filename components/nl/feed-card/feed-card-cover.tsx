"use client";

import { CardMetaWhen } from "@/components/nl/feed-card/feed-card-meta";
import { useFeedCardPhotoOpen } from "@/components/nl/feed-card/feed-card-photo-context";
import {
  feedCardTagClass,
  feedCardTagLabel,
} from "@/components/nl/feed-card/tag";
import type { GalleryImage } from "@/components/nl/photo-gallery";
import type { FeedPostType } from "@/lib/feed/types";

type Props = {
  image: GalleryImage;
  type: FeedPostType;
  pinned?: boolean;
  publishedAt: Date;
  userBadge?: string;
  metaExtra?: string;
  totalPhotos: number;
};

export function FeedCardCoverBlock({
  image,
  type,
  pinned,
  publishedAt,
  userBadge,
  metaExtra,
  totalPhotos,
}: Props) {
  const openAt = useFeedCardPhotoOpen();

  return (
    <div className="nl-card-cover">
      <img
        src={image.src}
        alt={image.alt}
        role={openAt ? "button" : undefined}
        tabIndex={openAt ? 0 : undefined}
        style={openAt ? { cursor: "pointer" } : undefined}
        onClick={openAt ? () => openAt(0) : undefined}
        onKeyDown={
          openAt
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openAt(0);
                }
              }
            : undefined
        }
      />
      <div className="nl-card-cover__scrim" aria-hidden="true" />
      <div className="nl-card-cover__meta">
        <div className="nl-card-cover__meta-start">
          <span className={feedCardTagClass(type, pinned)}>
            {feedCardTagLabel(type, pinned)}
          </span>
          <span className="nl-tag nl-tag--cover-meta">
            <CardMetaWhen pinned={pinned} publishedAt={publishedAt} />
          </span>
          {userBadge ? <span>{userBadge}</span> : null}
          {metaExtra ? <span>{metaExtra}</span> : null}
          {totalPhotos > 1 ? <span>{totalPhotos} фото</span> : null}
        </div>
      </div>
    </div>
  );
}
