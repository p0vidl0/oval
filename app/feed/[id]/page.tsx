import { notFound, permanentRedirect } from "next/navigation";
import { postPath } from "@/lib/feed/open-post-url";
import { isPostLive } from "@/lib/feed/publication";
import {
  getFeedPostById,
  getPublishedFeedPostBySlug,
} from "@/lib/feed/queries";
import { isLikelyPostSlug } from "@/lib/feed/slug";

type Props = {
  params: Promise<{ id: string }>;
};

/** Старые ссылки `/feed/{uuid}` и `/feed/{slug}` → канонический `/{slug}`. */
export default async function LegacyFeedPostRedirect({ params }: Props) {
  const { id } = await params;

  if (isLikelyPostSlug(id)) {
    const bySlug = await getPublishedFeedPostBySlug(id);
    if (bySlug) permanentRedirect(postPath(bySlug.slug));
  }

  const post = await getFeedPostById(id);
  if (!post || !isPostLive(post)) notFound();
  permanentRedirect(postPath(post.slug));
}
