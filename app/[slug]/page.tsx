import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FeedPostPageView } from "@/components/nl/feed-post-page";
import { postPath } from "@/lib/feed/open-post-url";
import { listImagesForPost } from "@/lib/feed/post-images";
import { getPublishedFeedPostBySlug } from "@/lib/feed/queries";
import { isLikelyPostSlug } from "@/lib/feed/slug";
import { metaDescriptionFromBody } from "@/lib/site/public-origin";
import { uploadPublicUrl } from "@/lib/uploads/storage";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; registered?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!isLikelyPostSlug(slug)) {
    return { title: "Не найдено" };
  }
  const post = await getPublishedFeedPostBySlug(slug);
  if (!post) {
    return { title: "Не найдено" };
  }

  const description = metaDescriptionFromBody(post.body);
  const images = await listImagesForPost(post.id);
  const cover = images[0];
  const coverUrl = cover ? uploadPublicUrl(cover.storageKey) : undefined;
  const publishedTime = (post.publishedAt ?? post.createdAt).toISOString();
  const canonical = postPath(post.slug);

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

export default async function PublicPostPage({ params, searchParams }: Props) {
  const { slug } = await params;
  if (!isLikelyPostSlug(slug)) notFound();
  const post = await getPublishedFeedPostBySlug(slug);
  if (!post) notFound();
  const query = await searchParams;
  return <FeedPostPageView post={post} searchParams={query} />;
}
