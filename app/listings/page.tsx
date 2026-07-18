import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { getServerI18n } from "@/lib/i18n/server"
import { ListingsGridWithLocation } from "@/components/listings/listings-grid-location"
import { DbErrorNotice } from "@/components/ui/db-error-notice"
import { Search } from "lucide-react"

interface ListingsPageProps {
  searchParams: Promise<{
    q?: string
    category?: string
    condition?: string
    minPrice?: string
    maxPrice?: string
    sort?: string
    lat?: string
    lng?: string
    radius?: string
  }>
}

export default async function ListingsPage({ searchParams }: ListingsPageProps) {
  const params = await searchParams
  const supabase = await createClient()
  const { t } = await getServerI18n()

  // Fetch categories for filter
  const { data: categories, error: categoriesError } = await supabase
    .schema('inventory_domain')
    .from("categories")
    .select("*")
    .order("name")

  const activeCategory = categories?.find((c) => c.slug === params.category)

  return (
    <div className="min-h-screen bg-muted/30">
      <DbErrorNotice message={categoriesError ? `${t("listings_page.categories_error")}: ${categoriesError.message}` : null} />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-bold tracking-[-0.01em] text-foreground">
            {activeCategory ? activeCategory.name : t("listings_page.all_tools")}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {t("listings_page.subtitle")}
          </p>
        </div>

        {/* Search */}
        <div className="mb-8">
          <form action="/listings" method="GET" className="relative max-w-2xl">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              name="q"
              defaultValue={params.q}
              placeholder={t("listings_page.search_placeholder")}
              className="w-full rounded-lg border border-input bg-background py-3 pl-12 pr-4 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {/* Preserve other filters */}
            {params.category && <input type="hidden" name="category" value={params.category} />}
            {params.condition && <input type="hidden" name="condition" value={params.condition} />}
            {params.sort && <input type="hidden" name="sort" value={params.sort} />}
            {params.lat && <input type="hidden" name="lat" value={params.lat} />}
            {params.lng && <input type="hidden" name="lng" value={params.lng} />}
            {params.radius && <input type="hidden" name="radius" value={params.radius} />}
          </form>
        </div>

        {/* Main content with client-side location handling */}
        <Suspense fallback={<ListingsGridSkeleton />}>
          <ListingsGridWithLocation
            categories={categories || []}
            initialParams={{
              q: params.q,
              category: params.category,
              condition: params.condition,
              minPrice: params.minPrice,
              maxPrice: params.maxPrice,
              sort: params.sort,
              lat: params.lat,
              lng: params.lng,
              radius: params.radius,
            }}
          />
        </Suspense>
      </div>
    </div>
  )
}

function ListingsGridSkeleton() {
  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      <aside className="w-full shrink-0 lg:w-72">
        <div className="animate-pulse space-y-4">
          <div className="h-40 rounded-xl bg-muted" />
          <div className="h-64 rounded-xl bg-muted" />
        </div>
      </aside>
      <main className="flex-1">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl border border-border bg-card">
              <div className="aspect-[4/3] bg-muted" />
              <div className="space-y-3 p-4">
                <div className="h-5 w-3/4 rounded bg-muted" />
                <div className="h-4 w-1/2 rounded bg-muted" />
                <div className="h-6 w-1/3 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

