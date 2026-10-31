import { notFound, permanentRedirect } from "next/navigation";
import { postPath } from "@/lib/feed/open-post-url";
import { getPublishedFeedPostBySlug } from "@/lib/feed/queries";
import { isLikelyPostSlug } from "@/lib/feed/slug";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Старые ссылки `/{slug}` → `/sessions/{slug}` или `/news/{slug}`. */
export default async function LegacyRootPostRedirect({
  params,
  searchParams,
}: Props) {
  const { slug } = await params;
  if (!isLikelyPostSlug(slug)) notFound();
  const post = await getPublishedFeedPostBySlug(slug);
  if (!post) notFound();

  const query = await searchParams;
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string") sp.set(key, value);
  }
  const qs = sp.toString();
  const path = postPath(post.slug, post.type);
  permanentRedirect(qs ? `${path}?${qs}` : path);
}
