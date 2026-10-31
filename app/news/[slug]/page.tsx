import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FeedPostPageView } from "@/components/nl/feed-post-page";
import {
  loadPublicDatedPost,
  metadataForPublicPost,
} from "@/lib/feed/public-dated-post";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; registered?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await loadPublicDatedPost(slug, "news");
  if (!post) return { title: "Не найдено" };
  return metadataForPublicPost(post);
}

export default async function NewsPostPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const post = await loadPublicDatedPost(slug, "news");
  if (!post) notFound();
  const query = await searchParams;
  return <FeedPostPageView post={post} searchParams={query} />;
}
