import type { FeedPostType } from "@/lib/feed/types";

/** Анонс тренировки — одно фото (обложка или боковое). */
export const MAX_IMAGES_TRAINING_ANNOUNCEMENT = 1;

/** Новости и прочие типы в редакторе. */
export const MAX_IMAGES_PUBLICATION_DEFAULT = 10;

export function maxImagesForPostType(type: FeedPostType): number {
  return type === "training_announcement"
    ? MAX_IMAGES_TRAINING_ANNOUNCEMENT
    : MAX_IMAGES_PUBLICATION_DEFAULT;
}
