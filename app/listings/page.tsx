import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { ListingsGrid } from "@/components/listings/listings-grid"
import { ListingsFilters } from "@/components/listings/listings-filters"
import { Search, SlidersHorizontal } from "lucide-react"

interface ListingsPageProps {
  searchParams: Promise<{
    q?: string
    category?: string
    condition?: string
    minPrice?: string
    maxPrice?: string
    sort?: string
  }>
}

export default async function ListingsPage({ searchParams }: ListingsPageProps) {
  const params = await searchParams
  const supabase = await createClient()

  // Fetch categories for filter
  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .order("name")

  // Build query
  let query = supabase
    .from("listings")
    .select(`
      *,
      owner:profiles!listings_owner_id_fkey(id, display_name, avatar_url, average_rating_as_owner),
      category:categories(id, name, slug),
      images:listing_images(id, image_url, display_order)
    `)
    .eq("is_active", true)
    .eq("is_available", true)

  // Apply filters
  if (params.q) {
    query = query.ilike("title", `%${params.q}%`)
  }

  if (params.category) {
    const { data: cat } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", params.category)
      .single()
    if (cat) {
      query = query.eq("category_id", cat.id)
    }
  }

  if (params.condition) {
    query = query.eq("condition", params.condition)
  }

  if (params.minPrice) {
    query = query.gte("price_per_day_cents", parseInt(params.minPrice) * 100)
  }

  if (params.maxPrice) {
    query = query.lte("price_per_day_cents", parseInt(params.maxPrice) * 100)
  }

  // Apply sorting
  switch (params.sort) {
    case "price_asc":
      query = query.order("price_per_day_cents", { ascending: true })
      break
    case "price_desc":
      query = query.order("price_per_day_cents", { ascending: false })
      break
    case "oldest":
      query = query.order("created_at", { ascending: true })
      break
    default:
      query = query.order("created_at", { ascending: false })
  }

  const { data: listings } = await query

  const activeCategory = categories?.find((c) => c.slug === params.category)

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">
            {activeCategory ? activeCategory.name : "Tutti gli attrezzi"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {listings?.length || 0} annunci disponibili
          </p>
        </div>

        {/* Search and Filters */}
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start">
          {/* Search */}
          <form action="/listings" method="GET" className="flex-1">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                name="q"
                defaultValue={params.q}
                placeholder="Cerca attrezzi..."
                className="w-full rounded-lg border border-input bg-background py-3 pl-12 pr-4 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              {/* Preserve other filters */}
              {params.category && <input type="hidden" name="category" value={params.category} />}
              {params.condition && <input type="hidden" name="condition" value={params.condition} />}
              {params.sort && <input type="hidden" name="sort" value={params.sort} />}
            </div>
          </form>
        </div>

        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Filters Sidebar */}
          <aside className="w-full shrink-0 lg:w-64">
            <ListingsFilters
              categories={categories || []}
              currentCategory={params.category}
              currentCondition={params.condition}
              currentSort={params.sort}
              currentMinPrice={params.minPrice}
              currentMaxPrice={params.maxPrice}
              searchQuery={params.q}
            />
          </aside>

          {/* Listings Grid */}
          <main className="flex-1">
            <Suspense fallback={<ListingsGridSkeleton />}>
              <ListingsGrid listings={listings || []} />
            </Suspense>
          </main>
        </div>
      </div>
    </div>
  )
}

function ListingsGridSkeleton() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-xl border border-border bg-card">
          <div className="aspect-[4/3] bg-muted" />
          <div className="p-4 space-y-3">
            <div className="h-5 w-3/4 rounded bg-muted" />
            <div className="h-4 w-1/2 rounded bg-muted" />
            <div className="h-6 w-1/3 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  )
}
