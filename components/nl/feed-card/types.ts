import type { GalleryImage } from "@/components/nl/photo-gallery";
import type { FeedPostType } from "@/lib/feed/types";

export type FeedCardTraining = {
  startsAt: Date;
  endsAt: Date | null;
  gatherAt: Date | null;
  coachName: string | null;
  priceCents: number;
  currency: string;
  capacity: number | null;
  activeCount: number;
  registrationEnabled: boolean;
  onlinePaymentEnabled: boolean;
  status: "scheduled" | "cancelled";
};

export type FeedCardActions = {
  registerHref?: string;
  registerForm?: React.ReactNode;
  payHref?: string;
  payLabel?: string;
  cancelForm?: React.ReactNode;
  externalHref?: string;
  externalLabel?: string;
  /** Перенос/отмена → анонс тренировки. */
  trainingHref?: string;
};

export type FeedCardProps = {
  postId: string;
  type: FeedPostType;
  title: string;
  body: string;
  publishedAt: Date;
  pinned?: boolean;
  eventDate?: Date | null;
  training?: FeedCardTraining | null;
  images?: GalleryImage[];
  imageCount?: number;
  metaExtra?: string;
  timeChange?: { oldTime: string; newTime: string };
  userBadge?: string;
  actions?: FeedCardActions;
  linkTitle?: boolean;
  previewMode?: boolean;
};
