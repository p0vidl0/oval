import type { Metadata } from "next";
import { postPath } from "@/lib/feed/open-post-url";
import { listImagesForPost } from "@/lib/feed/post-images";
import { getPublishedFeedPostBySlug } from "@/lib/feed/queries";
import { isLikelyPostSlug } from "@/lib/feed/slug";
import { metaDescriptionFromBody } from "@/lib/site/public-origin";
import { uploadPublicUrl } from "@/lib/uploads/storage";

export type DatedPostKind = "session" | "news";

export async function loadPublicDatedPost(slug: string, kind: DatedPostKind) {
  if (!isLikelyPostSlug(slug)) return null;
  const post = await getPublishedFeedPostBySlug(slug);
  if (!post) return null;
  const isAnnouncement = post.type === "training_announcement";
  if (kind === "session" && !isAnnouncement) return null;
  if (kind === "news" && isAnnouncement) return null;
  return post;
}

export async function metadataForPublicPost(
  post: NonNullable<Awaited<ReturnType<typeof getPublishedFeedPostBySlug>>>,
): Promise<Metadata> {
  const description = metaDescriptionFromBody(post.body);
  const images = await listImagesForPost(post.id);
  const cover = images[0];
  const coverUrl = cover ? uploadPublicUrl(cover.storageKey) : undefined;
  const publishedTime = (post.publishedAt ?? post.createdAt).toISOString();
  const canonical = postPath(post.slug, post.type);

  return {
    title: post.title,
    description,
    alternates: { canonical },
    openGraph: {
      title: post.title,
      description,
      type: "article",
      publishedTime,
      url: canonical,
      ...(coverUrl
        ? {
            images: [
              {
                url: coverUrl,
                alt: cover.alt.trim() || post.title,
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: coverUrl ? "summary_large_image" : "summary",
      title: post.title,
      description,
      ...(coverUrl ? { images: [coverUrl] } : {}),
    },
  };
}
