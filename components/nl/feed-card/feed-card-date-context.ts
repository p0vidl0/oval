import type { FeedCardTraining } from "@/components/nl/feed-card/types";
import type { FeedPostType } from "@/lib/feed/types";

export function feedCardDateContext(params: {
  type: FeedPostType;
  eventDate?: Date | null;
  training?: FeedCardTraining | null;
  publishedAt: Date;
}) {
  const cardDate =
    params.eventDate ??
    params.training?.startsAt ??
    (params.type === "news" ? null : params.publishedAt);
  const showDate =
    cardDate &&
    (params.type === "training_announcement" ||
      params.type === "training_cancelled" ||
      params.type === "training_rescheduled" ||
      params.type === "race");
  const cancelled =
    params.type === "training_cancelled" ||
    params.training?.status === "cancelled";

  return { cardDate, showDate, cancelled };
}
