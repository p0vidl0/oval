import type { FeedCardProps } from "@/components/nl/feed-card/types";

type Props = Pick<FeedCardProps, "postId" | "pinned"> & {
  withCoverClass?: boolean;
  header?: React.ReactNode;
  meta?: React.ReactNode;
  body: React.ReactNode;
  actions?: React.ReactNode;
};

export function FeedCardShell({
  postId,
  pinned,
  withCoverClass,
  header,
  meta,
  body,
  actions,
}: Props) {
  const cardClass = [
    "nl-card",
    pinned ? "nl-card--pinned" : "",
    withCoverClass ? "nl-card--with-cover" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={cardClass} data-post-id={postId}>
      {header}
      {meta}
      {body}
      {actions}
    </article>
  );
}
