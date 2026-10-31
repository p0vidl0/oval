import Link from "next/link";
import { postPath } from "@/lib/feed/open-post-url";
import type { FeedPostType } from "@/lib/feed/types";

export function FeedCardTitle({
  postSlug,
  type,
  title,
  linkTitle,
}: {
  postSlug: string;
  type: FeedPostType;
  title: string;
  linkTitle: boolean;
}) {
  if (linkTitle) {
    return (
      <Link
        href={postPath(postSlug, type)}
        style={{ color: "inherit", textDecoration: "none" }}
      >
        <h2 className="nl-display nl-card__title">{title}</h2>
      </Link>
    );
  }
  return <h2 className="nl-display nl-card__title">{title}</h2>;
}
