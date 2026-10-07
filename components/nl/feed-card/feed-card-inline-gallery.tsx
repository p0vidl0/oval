"use client";

import { useFeedCardPhotoOpen } from "@/components/nl/feed-card/feed-card-photo-context";
import type { GalleryImage } from "@/components/nl/photo-gallery";
import { NlPhotoGallery } from "@/components/nl/photo-gallery";

export function FeedCardInlineGallery({
  images,
  totalCount,
  indexOffset = 0,
}: {
  images: GalleryImage[];
  totalCount?: number;
  indexOffset?: number;
}) {
  const openAt = useFeedCardPhotoOpen();
  return (
    <NlPhotoGallery
      images={images}
      totalCount={totalCount}
      onOpenAt={openAt}
      indexOffset={indexOffset}
    />
  );
}
