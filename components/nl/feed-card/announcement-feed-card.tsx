import { NlDateStack } from "@/components/nl/date-stack";
import { FeedCardActionsBlock } from "@/components/nl/feed-card/feed-card-actions";
import { FeedCardCoverBlock } from "@/components/nl/feed-card/feed-card-cover";
import { feedCardDateContext } from "@/components/nl/feed-card/feed-card-date-context";
import { FeedCardInlineGallery } from "@/components/nl/feed-card/feed-card-inline-gallery";
import { FeedCardMetaRow } from "@/components/nl/feed-card/feed-card-meta-row";
import { FeedCardPhotoProvider } from "@/components/nl/feed-card/feed-card-photo-context";
import { FeedCardShell } from "@/components/nl/feed-card/feed-card-shell";
import { FeedCardSidePhoto } from "@/components/nl/feed-card/feed-card-side-photo";
import { FeedCardTitle } from "@/components/nl/feed-card/feed-card-title";
import { resolveFeedCardMedia } from "@/components/nl/feed-card/resolve-media";
import { FeedCardTrainingProgress } from "@/components/nl/feed-card/training-progress";
import type { FeedCardProps } from "@/components/nl/feed-card/types";
import { formatTimeHm, formatTimeRange } from "@/lib/format/datetime";

export function AnnouncementFeedCard(props: FeedCardProps) {
  const {
    postId,
    type,
    title,
    body,
    publishedAt,
    pinned,
    training,
    images = [],
    imageCount,
    metaExtra,
    userBadge,
    actions,
    linkTitle = true,
    previewMode,
    eventDate,
  } = props;

  const media = resolveFeedCardMedia(type, images, imageCount, pinned);
  const { cardDate, showDate, cancelled } = feedCardDateContext({
    type,
    eventDate,
    training,
    publishedAt,
  });

  const content = (
    <FeedCardShell
      postId={postId}
      pinned={pinned}
      withCoverClass={media.withCoverClass}
      header={
        media.coverImage ? (
          <FeedCardCoverBlock
            image={media.coverImage}
            type={type}
            pinned={pinned}
            publishedAt={publishedAt}
            userBadge={userBadge}
            metaExtra={metaExtra}
            totalPhotos={media.totalPhotos}
          />
        ) : null
      }
      meta={
        !media.hideTopMeta ? (
          <FeedCardMetaRow
            type={type}
            pinned={pinned}
            publishedAt={publishedAt}
            userBadge={userBadge}
            metaExtra={metaExtra}
            totalPhotos={media.totalPhotos}
          />
        ) : null
      }
      body={
        <div className="nl-card__body">
          {showDate && cardDate ? (
            <NlDateStack date={cardDate} cancelled={cancelled} />
          ) : null}
          <div className="nl-card__text">
            <FeedCardTitle
              postId={postId}
              title={title}
              linkTitle={linkTitle}
            />
            {training ? (
              <div className="nl-card__time nl-mono">
                <span>
                  {formatTimeRange(training.startsAt, training.endsAt)}
                </span>
                {training.gatherAt ? (
                  <span style={{ color: "var(--ink-muted)" }}>
                    сбор в {formatTimeHm(training.gatherAt)}
                  </span>
                ) : null}
              </div>
            ) : null}
            {body ? <p className="nl-card__p">{body}</p> : null}
            {media.galleryImages.length > 0 ? (
              <FeedCardInlineGallery
                images={media.galleryImages}
                totalCount={media.galleryTotalCount}
                indexOffset={media.galleryIndexOffset}
              />
            ) : null}
            {training ? <FeedCardTrainingProgress training={training} /> : null}
          </div>
          {media.sideImage ? (
            <FeedCardSidePhoto image={media.sideImage} index={0} />
          ) : null}
        </div>
      }
      actions={
        actions ? (
          <FeedCardActionsBlock actions={actions} previewMode={previewMode} />
        ) : null
      }
    />
  );

  return (
    <FeedCardPhotoProvider images={images}>{content}</FeedCardPhotoProvider>
  );
}
