import { createClient } from "@/lib/supabase/server"
import { HeroSection } from "@/components/home/hero-section"
import { CategorySection } from "@/components/home/category-section"
import { FeaturedSection } from "@/components/home/featured-section"
import { HowItWorksSection } from "@/components/home/how-it-works-section"
import { CTASection } from "@/components/home/cta-section"

export default async function HomePage() {
  const supabase = await createClient()

  // Fetch categories
  const { data: categories } = await supabase
    .schema('inventory_domain')
    .from("categories")
    .select("*")
    .order("name")

  // Fetch featured listings
  const { data: listings } = await supabase
    .schema('inventory_domain')
    .from("listings")
    .select(`
      *,
      owner:profiles!listings_owner_id_fkey(id, display_name, avatar_url, average_rating_as_owner),
      category:categories(name, slug),
      images:listing_images(id, image_url, display_order)
    `)
    .eq("is_active", true)
    .eq("is_available", true)
    .order("created_at", { ascending: false })
    .limit(8)

  return (
    <div className="flex flex-col">
      <HeroSection />
      <CategorySection categories={categories || []} />
      <FeaturedSection listings={listings || []} />
      <HowItWorksSection />
      <CTASection />
    </div>
  )
}
