import { AnnouncementFeedCard } from "@/components/nl/feed-card/announcement-feed-card";
import { DefaultFeedCard } from "@/components/nl/feed-card/default-feed-card";
import { NewsFeedCard } from "@/components/nl/feed-card/news-feed-card";
import { TrainingChangeFeedCard } from "@/components/nl/feed-card/training-change-feed-card";
import type { FeedCardProps } from "@/components/nl/feed-card/types";

export type {
  FeedCardActions,
  FeedCardProps,
  FeedCardTraining,
} from "@/components/nl/feed-card/types";

export function NlFeedPostCard(props: FeedCardProps) {
  switch (props.type) {
    case "training_announcement":
      return <AnnouncementFeedCard {...props} />;
    case "news":
      return <NewsFeedCard {...props} />;
    case "training_cancelled":
    case "training_rescheduled":
      return <TrainingChangeFeedCard {...props} />;
    default:
      return <DefaultFeedCard {...props} />;
  }
}
