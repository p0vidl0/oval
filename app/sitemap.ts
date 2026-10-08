import type { MetadataRoute } from "next";
import { listLiveFeedPostsForSitemap } from "@/lib/feed/queries";
import { absoluteSiteUrl } from "@/lib/site/public-origin";

/** Посты из БД — не пререндер на `next build` без DATABASE_URL. */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await listLiveFeedPostsForSitemap();
  const latestPostUpdate = posts.reduce<Date | undefined>((max, post) => {
    const t = post.updatedAt;
    return !max || t > max ? t : max;
  }, undefined);

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: absoluteSiteUrl("/feed"),
      lastModified: latestPostUpdate ?? new Date(),
      changeFrequency: "hourly",
      priority: 1,
    },
  ];

  const postPages: MetadataRoute.Sitemap = posts.map((post) => ({
    url: absoluteSiteUrl(`/feed/${post.id}`),
    lastModified: post.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [...staticPages, ...postPages];
}
