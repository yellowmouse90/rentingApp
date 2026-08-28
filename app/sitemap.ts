import type { MetadataRoute } from "next"
import { createClient } from "@/lib/supabase/server"
import { getSiteUrl } from "@/lib/seo"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl()
  const supabase = await createClient()

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/listings`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${siteUrl}/how-it-works`, changeFrequency: "monthly", priority: 0.5 },
  ]

  const { data: listings } = await supabase
    .schema("inventory_domain")
    .from("listings")
    .select("id, updated_at")
    .eq("is_active", true)
    .eq("is_available", true)
    .order("updated_at", { ascending: false })
    .limit(5000)

  const listingRoutes: MetadataRoute.Sitemap = (listings || []).map((listing) => ({
    url: `${siteUrl}/listings/${listing.id}`,
    lastModified: listing.updated_at,
    changeFrequency: "weekly",
    priority: 0.7,
  }))

  return [...staticRoutes, ...listingRoutes]
}
