import type { MetadataRoute } from "next";
import { absoluteSiteUrl } from "@/lib/site/public-origin";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/cabinet/", "/login", "/api/"],
    },
    sitemap: absoluteSiteUrl("/sitemap.xml"),
  };
}
