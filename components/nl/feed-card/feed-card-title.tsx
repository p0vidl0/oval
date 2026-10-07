import Link from "next/link";

export function FeedCardTitle({
  postId,
  title,
  linkTitle,
}: {
  postId: string;
  title: string;
  linkTitle: boolean;
}) {
  if (linkTitle) {
    return (
      <Link
        href={`/feed/${postId}`}
        style={{ color: "inherit", textDecoration: "none" }}
      >
        <h2 className="nl-display nl-card__title">{title}</h2>
      </Link>
    );
  }
  return <h2 className="nl-display nl-card__title">{title}</h2>;
}
