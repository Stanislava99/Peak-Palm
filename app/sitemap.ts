import { getSiteUrl } from "@/lib/site";
import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const site = getSiteUrl();
  const lastModified = new Date();
  return [
    { url: `${site}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${site}/villa-kaja`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: `${site}/janis`, lastModified, changeFrequency: "weekly", priority: 0.9 },
  ];
}
