import { NlDateStack } from "@/components/nl/date-stack";
import { FeedCardActionsBlock } from "@/components/nl/feed-card/feed-card-actions";
import { feedCardDateContext } from "@/components/nl/feed-card/feed-card-date-context";
import { FeedCardInlineGallery } from "@/components/nl/feed-card/feed-card-inline-gallery";
import { FeedCardMetaRow } from "@/components/nl/feed-card/feed-card-meta-row";
import { FeedCardPhotoProvider } from "@/components/nl/feed-card/feed-card-photo-context";
import { FeedCardShell } from "@/components/nl/feed-card/feed-card-shell";
import { FeedCardTitle } from "@/components/nl/feed-card/feed-card-title";
import { resolveFeedCardMedia } from "@/components/nl/feed-card/resolve-media";
import type { FeedCardProps } from "@/components/nl/feed-card/types";

export function TrainingChangeFeedCard(props: FeedCardProps) {
  const {
    postId,
    type,
    title,
    body,
    publishedAt,
    pinned,
    eventDate,
    training,
    images = [],
    imageCount,
    metaExtra,
    userBadge,
    timeChange,
    actions,
    linkTitle = true,
    previewMode,
  } = props;

  const media = resolveFeedCardMedia(type, images, imageCount);
  const { cardDate, showDate, cancelled } = feedCardDateContext({
    type,
    eventDate,
    training,
    publishedAt,
  });

  return (
    <FeedCardPhotoProvider images={images}>
      <FeedCardShell
        postId={postId}
        pinned={pinned}
        meta={
          <FeedCardMetaRow
            type={type}
            pinned={pinned}
            publishedAt={publishedAt}
            userBadge={userBadge}
            metaExtra={metaExtra}
            totalPhotos={media.totalPhotos}
          />
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
              {timeChange ? (
                <div className="nl-timechange">
                  <span className="nl-timechange__old">
                    {timeChange.oldTime}
                  </span>
                  <span className="nl-timechange__arrow" aria-hidden="true">
                    →
                  </span>
                  <span className="nl-timechange__new">
                    {timeChange.newTime}
                  </span>
                </div>
              ) : null}
              {body ? <p className="nl-card__p">{body}</p> : null}
              {media.galleryImages.length > 0 ? (
                <FeedCardInlineGallery images={media.galleryImages} />
              ) : null}
            </div>
          </div>
        }
        actions={
          actions ? (
            <FeedCardActionsBlock actions={actions} previewMode={previewMode} />
          ) : null
        }
      />
    </FeedCardPhotoProvider>
  );
}
