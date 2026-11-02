import { getSiteUrl, isPreviewDeployment } from "@/lib/site";
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  if (isPreviewDeployment()) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
