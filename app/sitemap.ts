import { MetadataRoute } from "next";
import { STATE_CODES } from "@/lib/states";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://refugee-node.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/map`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/directory`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/urgent`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.95,
    },
  ];

  const stateRoutes: MetadataRoute.Sitemap = STATE_CODES.map(state => ({
    url: `${BASE_URL}/directory/${state}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  return [...staticRoutes, ...stateRoutes];
}
