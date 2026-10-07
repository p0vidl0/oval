"use client";

import { useFeedCardPhotoOpen } from "@/components/nl/feed-card/feed-card-photo-context";
import type { GalleryImage } from "@/components/nl/photo-gallery";

export function FeedCardSidePhoto({
  image,
  index = 0,
}: {
  image: GalleryImage;
  index?: number;
}) {
  const openAt = useFeedCardPhotoOpen();

  return (
    <div className="nl-card__side-photo">
      <img
        src={image.src}
        alt={image.alt}
        role={openAt ? "button" : undefined}
        tabIndex={openAt ? 0 : undefined}
        onClick={openAt ? () => openAt(index) : undefined}
        onKeyDown={
          openAt
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openAt(index);
                }
              }
            : undefined
        }
      />
    </div>
  );
}
