import type { GalleryImage } from "@/components/nl/photo-gallery";
import type { FeedPostType } from "@/lib/feed/types";

/** Правила раскладки фото — см. классы `.nl-card*` в `app/nl-bundle.css`. */
export function resolveFeedCardMedia(
  type: FeedPostType,
  images: GalleryImage[],
  imageCount?: number,
  pinned?: boolean,
) {
  const totalPhotos = imageCount ?? images.length;
  const isAnnouncement = type === "training_announcement";
  const announcementHeaderCover =
    isAnnouncement && Boolean(pinned) && images.length > 0;
  const announcementSidePhoto = isAnnouncement && !pinned && images.length > 0;

  const coverImage = announcementHeaderCover ? images[0] : null;
  const sideImage = announcementSidePhoto ? images[0] : null;
  const usesFirstAsHero = announcementHeaderCover || announcementSidePhoto;
  const galleryImages = usesFirstAsHero ? images.slice(1) : images;
  const galleryTotalCount =
    usesFirstAsHero && totalPhotos > 1 ? totalPhotos : undefined;

  return {
    announcementHeaderCover,
    announcementSidePhoto,
    coverImage,
    sideImage,
    galleryImages,
    totalPhotos,
    galleryTotalCount,
    galleryIndexOffset: usesFirstAsHero ? 1 : 0,
    withCoverClass: announcementHeaderCover,
    hideTopMeta: announcementHeaderCover,
  };
}
