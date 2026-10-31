import Link from "next/link";
import { postPath } from "@/lib/feed/open-post-url";

export function FeedCardTitle({
  postSlug,
  title,
  linkTitle,
}: {
  postSlug: string;
  title: string;
  linkTitle: boolean;
}) {
  if (linkTitle) {
    return (
      <Link
        href={postPath(postSlug)}
        style={{ color: "inherit", textDecoration: "none" }}
      >
        <h2 className="nl-display nl-card__title">{title}</h2>
      </Link>
    );
  }
  return <h2 className="nl-display nl-card__title">{title}</h2>;
}
