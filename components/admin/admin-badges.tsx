import type { ReactNode } from "react";
import { NlStatus } from "@/components/nl/status";
import type { FeedPostStatus } from "@/lib/feed/types";
import { FEED_POST_STATUS_LABELS } from "@/lib/feed/types";
import {
  TRAINING_STATUS_LABELS,
  type TrainingDisplayStatus,
} from "@/lib/training/status";

const TRAINING_VARIANT = {
  scheduled: "default",
  rescheduled: "due",
  cancelled: "cancelled",
  past: "draft",
} as const;

export function TrainingStatusBadge({
  status,
}: {
  status: TrainingDisplayStatus;
}) {
  return (
    <NlStatus variant={TRAINING_VARIANT[status]}>
      {TRAINING_STATUS_LABELS[status]}
    </NlStatus>
  );
}

export function PostStatusBadge({
  status,
  publishedAt,
  now,
}: {
  status: FeedPostStatus;
  publishedAt: Date | null;
  now: Date;
}) {
  if (status === "published" && publishedAt && publishedAt > now) {
    return <NlStatus variant="due">Запланировано</NlStatus>;
  }
  const variant =
    status === "draft"
      ? "draft"
      : status === "unpublished"
        ? "cancelled"
        : "default";
  return (
    <NlStatus variant={variant}>{FEED_POST_STATUS_LABELS[status]}</NlStatus>
  );
}

/** Сообщение после действия (`?done=`) или ошибка (`?error=`). */
export function AdminBanner({
  tone,
  children,
}: {
  tone: "ok" | "error";
  children: ReactNode;
}) {
  return (
    <div
      className={`nl-admin-banner nl-admin-banner--${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
