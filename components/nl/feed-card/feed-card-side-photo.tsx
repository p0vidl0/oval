"use client";

import { NlContentImage } from "@/components/nl/content-image";
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
      <NlContentImage
        src={image.src}
        alt={image.alt}
        sizes="280px"
        role={openAt ? "button" : undefined}
        tabIndex={openAt ? 0 : undefined}
        style={openAt ? { cursor: "pointer" } : undefined}
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
