import { FeedCardActionsBlock } from "@/components/nl/feed-card/feed-card-actions";
import { FeedCardInlineGallery } from "@/components/nl/feed-card/feed-card-inline-gallery";
import { FeedCardMetaRow } from "@/components/nl/feed-card/feed-card-meta-row";
import { FeedCardPhotoProvider } from "@/components/nl/feed-card/feed-card-photo-context";
import { FeedCardShell } from "@/components/nl/feed-card/feed-card-shell";
import { FeedCardTitle } from "@/components/nl/feed-card/feed-card-title";
import { resolveFeedCardMedia } from "@/components/nl/feed-card/resolve-media";
import type { FeedCardProps } from "@/components/nl/feed-card/types";

export function NewsFeedCard(props: FeedCardProps) {
  const {
    postId,
    type,
    title,
    body,
    publishedAt,
    pinned,
    images = [],
    imageCount,
    metaExtra,
    userBadge,
    actions,
    linkTitle = true,
    previewMode,
  } = props;

  const media = resolveFeedCardMedia(type, images, imageCount);

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
            <div className="nl-card__text">
              <FeedCardTitle
                postId={postId}
                title={title}
                linkTitle={linkTitle}
              />
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
