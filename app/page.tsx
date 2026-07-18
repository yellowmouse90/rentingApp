import { createClient } from "@/lib/supabase/server"
import { HeroSection } from "@/components/home/hero-section"
import { CategorySection } from "@/components/home/category-section"
import { FeaturedSection } from "@/components/home/featured-section"
import { HowItWorksSection } from "@/components/home/how-it-works-section"
import { CTASection } from "@/components/home/cta-section"
import { DbErrorNotice } from "@/components/ui/db-error-notice"

export default async function HomePage() {
  const supabase = await createClient()

  // Fetch categories
  const { data: categories, error: categoriesError } = await supabase
    .schema('inventory_domain')
    .from("categories")
    .select("*")
    .order("name")

  // Fetch featured listings
  const { data: listings, error: listingsError } = await supabase
    .schema('inventory_domain')
    .from("listings")
    .select(`
      *,
      category:categories(name, slug),
      images:listing_images(id, image_url, display_order)
    `)
    .eq("is_active", true)
    .eq("is_available", true)
    .order("created_at", { ascending: false })
    .limit(8)

  const dbErrors = [categoriesError, listingsError].filter(Boolean).map((e) => e!.message)

  return (
    <div className="flex flex-col">
      <DbErrorNotice message={dbErrors.length ? dbErrors.join(" | ") : null} />
      <HeroSection />
      <CategorySection categories={categories || []} />
      <FeaturedSection listings={listings || []} />
      <HowItWorksSection />
      <CTASection />
    </div>
  )
}

