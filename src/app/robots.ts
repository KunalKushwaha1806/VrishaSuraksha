import type { MetadataRoute } from "next";

/**
 * Standard robots.txt configuration for VridhaSuraksha.
 * Keeps authenticated circle routes private while allowing indexation of landing pages.
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.APP_URL || "https://vridhasuraksha.vercel.app";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/demo", "/login", "/join", "/create"],
        disallow: ["/app", "/api/", "/a/", "/e/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
