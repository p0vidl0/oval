import type { FeedCardProps } from "@/components/nl/feed-card/types";
import type { GalleryImage } from "@/components/nl/photo-gallery";
import {
  readTrainingScheduleFromHtmlForm,
  resolveTrainingCapacity,
} from "@/lib/admin/training-form-schedule";
import { maxImagesForPostType } from "@/lib/feed/post-image-limits";
import type { FeedPostType } from "@/lib/feed/types";
import { formatPriceRub } from "@/lib/format/datetime";

export type PublicationPreviewExistingImage = {
  id: string;
  src: string;
  alt: string;
};

function readCheckbox(form: HTMLFormElement, name: string): boolean {
  const el = form.elements.namedItem(name);
  if (!(el instanceof HTMLInputElement)) return false;
  return el.checked;
}

function readString(form: HTMLFormElement, name: string): string {
  const el = form.elements.namedItem(name);
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
    return "";
  }
  return el.value;
}

function removedImageIds(form: HTMLFormElement): Set<string> {
  return new Set(
    Array.from(
      form.querySelectorAll<HTMLInputElement>(
        'input[name="remove_image_ids"]:checked',
      ),
    ).map((el) => el.value),
  );
}

export function countKeptExistingImages(
  form: HTMLFormElement | null,
  existing: PublicationPreviewExistingImage[],
): number {
  if (existing.length === 0) return 0;
  if (!form) return existing.length;
  const removed = removedImageIds(form);
  return existing.filter((img) => !removed.has(img.id)).length;
}

export function collectPreviewImages(
  form: HTMLFormElement,
  existing: PublicationPreviewExistingImage[],
  pendingUploads: GalleryImage[] = [],
): GalleryImage[] {
  const removed = removedImageIds(form);
  const kept = existing.filter((img) => !removed.has(img.id));

  return [
    ...kept.map((img) => ({ src: img.src, alt: img.alt })),
    ...pendingUploads,
  ];
}

export type PublicationFormSnapshot = {
  postType: FeedPostType;
  title: string;
  body: string;
  pinned: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  gatherAt: Date | null;
  capacity: number | null;
  priceRub: number;
  registrationEnabled: boolean;
  onlinePaymentEnabled: boolean;
  images: GalleryImage[];
};

/** Данные тренировки, когда в форме нет её полей (анонс к существующей тренировке). */
export type PreviewTrainingValues = Pick<
  PublicationFormSnapshot,
  | "startsAt"
  | "endsAt"
  | "gatherAt"
  | "capacity"
  | "priceRub"
  | "registrationEnabled"
  | "onlinePaymentEnabled"
>;

export function readPublicationFormSnapshot(
  form: HTMLFormElement,
  options: {
    postType: FeedPostType;
    existingImages: PublicationPreviewExistingImage[];
    pendingUploads?: GalleryImage[];
    fixedTraining?: PreviewTrainingValues | null;
  },
): PublicationFormSnapshot {
  const postType = options.postType;
  const images = collectPreviewImages(
    form,
    options.existingImages,
    options.pendingUploads,
  ).slice(0, maxImagesForPostType(postType));
  const title =
    readString(form, "title").trim() ||
    readString(form, "training_title").trim();
  if (options.fixedTraining) {
    return {
      postType,
      title,
      body: readString(form, "body").trim(),
      pinned: readCheckbox(form, "pinned"),
      ...options.fixedTraining,
      images,
    };
  }
  const isTraining = postType === "training_announcement";
  const capacityRaw = readString(form, "capacity");
  const capacityNum = resolveTrainingCapacity(capacityRaw);
  const priceRub = Number(readString(form, "price_rub") || "0");
  const schedule = isTraining ? readTrainingScheduleFromHtmlForm(form) : null;

  return {
    postType,
    title,
    body: readString(form, "body").trim(),
    pinned: readCheckbox(form, "pinned"),
    startsAt: schedule?.startsAt ?? null,
    endsAt: schedule?.endsAt ?? null,
    gatherAt: schedule?.gatherAt ?? null,
    capacity:
      isTraining && !Number.isNaN(capacityNum) && capacityNum >= 1
        ? capacityNum
        : null,
    priceRub: Number.isNaN(priceRub) ? 0 : priceRub,
    registrationEnabled: isTraining
      ? readCheckbox(form, "registration_enabled")
      : false,
    onlinePaymentEnabled: isTraining
      ? readCheckbox(form, "online_payment_enabled")
      : false,
    images,
  };
}

export function snapshotToFeedCardProps(
  snapshot: PublicationFormSnapshot,
): FeedCardProps {
  const now = new Date();
  const priceCents = Math.round(snapshot.priceRub * 100);
  const training =
    snapshot.postType === "training_announcement" && snapshot.startsAt
      ? {
          startsAt: snapshot.startsAt,
          endsAt: snapshot.endsAt,
          gatherAt: snapshot.gatherAt,
          coachName: null,
          priceCents,
          currency: "RUB",
          capacity: snapshot.capacity,
          activeCount: 0,
          registrationEnabled: snapshot.registrationEnabled,
          onlinePaymentEnabled: snapshot.onlinePaymentEnabled,
          status: "scheduled" as const,
        }
      : null;

  const actions =
    snapshot.postType === "training_announcement" && training
      ? {
          registerHref: snapshot.registrationEnabled ? "#" : undefined,
          payHref:
            snapshot.onlinePaymentEnabled && priceCents > 0 ? "#" : undefined,
          payLabel:
            snapshot.onlinePaymentEnabled && priceCents > 0
              ? `Оплатить · ${formatPriceRub(priceCents)}`
              : undefined,
        }
      : undefined;

  return {
    postId: "preview",
    type: snapshot.postType,
    title: snapshot.title || "Заголовок",
    body: snapshot.body,
    publishedAt: now,
    pinned: snapshot.pinned,
    training,
    images: snapshot.images,
    imageCount: snapshot.images.length,
    actions,
    linkTitle: false,
    previewMode: true,
  };
}
