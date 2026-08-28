import type { MetadataRoute } from "next"
import { getSiteUrl } from "@/lib/seo"

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl()

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard",
          "/dashboard/*",
          "/messages",
          "/messages/*",
          "/bookings",
          "/bookings/*",
          "/profile",
          "/profile/*",
          "/auth",
          "/auth/*",
          "/api/*",
          "/listings/new",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
