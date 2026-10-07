import { formatRelativeFeedMeta } from "@/lib/format/datetime";

export function CardMetaWhen({
  pinned,
  publishedAt,
}: {
  pinned?: boolean;
  publishedAt: Date;
}) {
  return (
    <>
      {pinned ? "закреплено · " : ""}
      {formatRelativeFeedMeta(publishedAt)}
    </>
  );
}
