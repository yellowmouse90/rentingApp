"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/auth/context"
import { useLanguage } from "@/lib/i18n/language-context"
import { detectCurrentLocation } from "@/lib/location/client"
import type { Category } from "@/lib/types"
import { formatPrice, getConditionLabel } from "@/lib/utils"
import { LocationSearch } from "./location-search"
import { ListingsFilters } from "./listings-filters"
import { ImageIcon, Package, MapPin, Loader2, LocateFixed } from "lucide-react"

const PAGE_SIZE = 50

interface ListingsGridWithLocationProps {
  categories: Category[]
  initialParams: {
    q?: string
    category?: string
    condition?: string
    minPrice?: string
    maxPrice?: string
    sort?: string
    lat?: string
    lng?: string
    radius?: string
  }
}

interface ListingWithDistance {
  id: string
  owner_id: string
  category_id: string
  title: string
  description: string
  condition: string
  price_per_day_cents: number
  price_per_week_cents: number | null
  currency_code: string
  deposit_cents: number
  item_location_name: string
  is_available: boolean
  views_count: number
  created_at: string
  distance_km: number
  owner_display_name: string
  owner_avatar_url: string | null
  owner_rating: number
  category_name: string
  category_icon: string
  first_image_url: string | null
}

export function ListingsGridWithLocation({
  categories,
  initialParams,
}: ListingsGridWithLocationProps) {
  const router = useRouter()
  const supabase = createClient()
  const { user } = useAuth()
  const { t } = useLanguage()
  
  const [location, setLocation] = useState<{ lat: number; lng: number; name: string } | null>(
    initialParams.lat && initialParams.lng
      ? { lat: parseFloat(initialParams.lat), lng: parseFloat(initialParams.lng), name: "" }
      : null
  )
  const [radius, setRadius] = useState(initialParams.radius ? parseInt(initialParams.radius) : 50)
  const [listings, setListings] = useState<ListingWithDistance[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [isAutoDetecting, setIsAutoDetecting] = useState(!(initialParams.lat && initialParams.lng))
  const autoDetectAttempted = useRef(false)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const categoryChildrenMap = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const category of categories) {
      if (category.parent_id) {
        const children = map.get(category.parent_id) || []
        children.push(category.id)
        map.set(category.parent_id, children)
      }
    }
    return map
  }, [categories])

  const getDescendantCategoryIds = useCallback((categoryId: string) => {
    const ids = [categoryId]
    const stack = [categoryId]

    while (stack.length > 0) {
      const currentId = stack.pop()
      if (!currentId) continue
      const children = categoryChildrenMap.get(currentId)
      if (!children) continue

      for (const childId of children) {
        ids.push(childId)
        stack.push(childId)
      }
    }

    return ids
  }, [categoryChildrenMap])

  const getCategoryFilterIds = useCallback(() => {
    if (!initialParams.category) return null
    const category = categories.find((c) => c.slug === initialParams.category)
    if (!category) return null
    return getDescendantCategoryIds(category.id)
  }, [categories, getDescendantCategoryIds, initialParams.category])

  const hasLocation = !!location && location.lat !== 0 && location.lng !== 0

  // Fallback used only if the geographic search itself fails (e.g. RPC error).
  const runRegularQueryFallback = useCallback(async () => {
    const categoryFilterIds = getCategoryFilterIds()

    let query = supabase
      .schema('inventory_domain')
      .from("listings")
      .select(`
        *,
        category:categories(
          id,
          slug,
          translated:category_translations(
            name
          )
        ),
        images:listing_images(id, image_url, display_order)
      `)
      .eq("is_active", true)
      .eq("is_available", true)

    if (initialParams.q) {
      query = query.ilike("title", `%${initialParams.q}%`)
    }

    if (categoryFilterIds && categoryFilterIds.length > 0) {
      query = query.in("category_id", categoryFilterIds)
    }

    if (user?.id) {
      query = query.neq("owner_id", user.id)
    }

    if (initialParams.condition) {
      query = query.eq("condition", initialParams.condition)
    }

    if (initialParams.minPrice) {
      query = query.gte("price_per_day_cents", parseInt(initialParams.minPrice) * 100)
    }

    if (initialParams.maxPrice) {
      query = query.lte("price_per_day_cents", parseInt(initialParams.maxPrice) * 100)
    }

    query = query.order("created_at", { ascending: false }).limit(PAGE_SIZE)

    const { data, error } = await query

    if (!error && data) {
      const transformed = data.map((listing: any) => ({
        id: listing.id,
        owner_id: listing.owner_id,
        category_id: listing.category_id,
        title: listing.title,
        description: listing.description,
        condition: listing.condition,
        price_per_day_cents: listing.price_per_day_cents,
        price_per_week_cents: listing.price_per_week_cents,
        currency_code: listing.currency_code,
        deposit_cents: listing.deposit_cents,
        item_location_name: listing.item_location_name || "",
        is_available: listing.is_available,
        views_count: listing.views_count,
        created_at: listing.created_at,
        distance_km: -1,
        owner_display_name: "",
        owner_avatar_url: null,
        owner_rating: 0,
        category_name: listing.category?.name || "",
        category_icon: listing.category?.icon_name || "",
        first_image_url: listing.images?.sort((a: any, b: any) => a.display_order - b.display_order)[0]?.image_url || null,
      }))

      setListings(transformed)
      setTotalCount(transformed.length)
    } else {
      console.error("[listings] Regular query fallback failed:", error)
      setListings([])
      setTotalCount(0)
    }
    setHasMore(false)
  }, [getCategoryFilterIds, initialParams, supabase, user])

  const fetchNearbyPage = useCallback(async (pageNum: number, append: boolean) => {
    if (!location || !hasLocation) return

    const { data, error } = await supabase
      .schema('inventory_domain')
      .rpc("search_listings_nearby", {
        user_lat: location.lat,
        user_lng: location.lng,
        radius_km: radius,
        category_slug: initialParams.category || null,
        search_query: initialParams.q || null,
        min_price: initialParams.minPrice ? parseInt(initialParams.minPrice) * 100 : null,
        max_price: initialParams.maxPrice ? parseInt(initialParams.maxPrice) * 100 : null,
        item_condition: initialParams.condition || null,
        page_limit: PAGE_SIZE,
        page_offset: pageNum * PAGE_SIZE,
      })

    if (!error && data) {
      const filtered = user?.id ? data.filter((listing: any) => listing.owner_id !== user.id) : data
      setListings((prev) => (append ? [...prev, ...filtered] : filtered))
      setTotalCount((prev) => (append ? prev + filtered.length : filtered.length))
      setHasMore(data.length === PAGE_SIZE)
      setPage(pageNum)
    } else {
      console.error("[listings] Nearby search failed:", error)
      if (!append) {
        await runRegularQueryFallback()
      } else {
        setHasMore(false)
      }
    }
  }, [location, hasLocation, radius, initialParams, supabase, user, runRegularQueryFallback])

  // Reset and fetch the first page whenever the location or filters change.
  useEffect(() => {
    if (!hasLocation) {
      setListings([])
      setTotalCount(0)
      setHasMore(false)
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)
    fetchNearbyPage(0, false).finally(() => {
      if (!cancelled) setIsLoading(false)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLocation, location?.lat, location?.lng, radius, initialParams.q, initialParams.category, initialParams.condition, initialParams.minPrice, initialParams.maxPrice])

  const loadMore = useCallback(() => {
    if (isLoadingMore || isLoading || !hasMore || !hasLocation) return
    setIsLoadingMore(true)
    fetchNearbyPage(page + 1, true).finally(() => setIsLoadingMore(false))
  }, [isLoadingMore, isLoading, hasMore, hasLocation, page, fetchNearbyPage])

  // Infinite scroll: fetch the next page when the sentinel at the bottom of the grid becomes visible.
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasLocation) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore()
      },
      { rootMargin: "400px" }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore, hasLocation, listings.length])

  const handleLocationChange = (lat: number, lng: number, name: string) => {
    if (lat === 0 && lng === 0) {
      setLocation(null)
      // Update URL to remove location params
      const params = new URLSearchParams()
      if (initialParams.q) params.set("q", initialParams.q)
      if (initialParams.category) params.set("category", initialParams.category)
      if (initialParams.condition) params.set("condition", initialParams.condition)
      router.push(`/listings?${params.toString()}`)
    } else {
      setLocation({ lat, lng, name })
      // Update URL with location params
      const params = new URLSearchParams()
      if (initialParams.q) params.set("q", initialParams.q)
      if (initialParams.category) params.set("category", initialParams.category)
      if (initialParams.condition) params.set("condition", initialParams.condition)
      params.set("lat", lat.toString())
      params.set("lng", lng.toString())
      params.set("radius", radius.toString())
      router.push(`/listings?${params.toString()}`)
    }
  }

  // On first load, if no location was passed via URL, silently ask for geolocation
  // permission (or use it immediately if already granted) and search around it.
  useEffect(() => {
    if (location || autoDetectAttempted.current) return
    autoDetectAttempted.current = true

    detectCurrentLocation()
      .then((detected) => {
        handleLocationChange(detected.lat, detected.lng, detected.name)
      })
      .catch(() => {
        // Permission denied, unavailable, or unsupported - fall back to asking
        // the user to set a location manually via the sidebar.
      })
      .finally(() => setIsAutoDetecting(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleRadiusChange = (newRadius: number) => {
    setRadius(newRadius)
    if (location) {
      const params = new URLSearchParams()
      if (initialParams.q) params.set("q", initialParams.q)
      if (initialParams.category) params.set("category", initialParams.category)
      if (initialParams.condition) params.set("condition", initialParams.condition)
      params.set("lat", location.lat.toString())
      params.set("lng", location.lng.toString())
      params.set("radius", newRadius.toString())
      router.push(`/listings?${params.toString()}`)
    }
  }

  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      {/* Filters Sidebar */}
      <aside className="w-full shrink-0 space-y-4 lg:w-72">
        {/* Location Search */}
        <LocationSearch
          onLocationChange={handleLocationChange}
          currentLocation={location}
          radius={radius}
          onRadiusChange={handleRadiusChange}
        />

        {/* Regular Filters */}
        <ListingsFilters
          categories={categories}
          currentCategory={initialParams.category}
          currentCondition={initialParams.condition}
          currentSort={initialParams.sort}
          currentMinPrice={initialParams.minPrice}
          currentMaxPrice={initialParams.maxPrice}
          searchQuery={initialParams.q}
        />
      </aside>

      {/* Listings Grid */}
      <main className="flex-1">
        {/* Results count */}
        {hasLocation && (
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {isLoading ? (
                t("common.loading")
              ) : (
                <>
                  <span className="font-semibold text-foreground">{totalCount}</span> {t("listings_grid.results_count")}
                  {" "}{t("listings_grid.within")} <span className="font-semibold text-foreground">{radius} km</span> {t("listings_grid.km_from")} {location!.name}
                </>
              )}
            </p>
          </div>
        )}

        {!hasLocation && isAutoDetecting ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !hasLocation ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
            <LocateFixed className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold text-foreground">{t("listings_grid.location_required_title")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{t("listings_grid.location_required_subtitle")}</p>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : listings.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
            <Package className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold text-foreground">{t("listings_grid.no_results")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("listings_grid.no_results_with_location")}
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {listings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} showDistance={hasLocation} />
              ))}
            </div>
            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="h-1" />
            {isLoadingMore && (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                {t("listings_grid.loading_more")}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

function ListingCard({ listing, showDistance }: { listing: ListingWithDistance; showDistance: boolean }) {
  const { t } = useLanguage()
  return (
    <Link
      href={`/listings/${listing.id}`}
      className="group overflow-hidden rounded-2xl border border-border bg-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/5"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {listing.first_image_url ? (
          <img
            src={listing.first_image_url}
            alt={listing.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <ImageIcon className="h-12 w-12 text-muted-foreground/50" />
          </div>
        )}
        <div className="absolute left-2 top-2">
          <span className="rounded-md bg-background/90 px-2 py-1 text-xs font-medium text-foreground backdrop-blur-sm">
            {getConditionLabel(listing.condition, t)}
          </span>
        </div>
        {showDistance && listing.distance_km >= 0 && (
          <div className="absolute right-2 top-2">
            <span className="flex items-center gap-1 rounded-md bg-primary/90 px-2 py-1 text-xs font-medium text-primary-foreground backdrop-blur-sm">
              <MapPin className="h-3 w-3" />
              {listing.distance_km < 1 
                ? `${Math.round(listing.distance_km * 1000)} m` 
                : `${listing.distance_km.toFixed(1)} km`}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="line-clamp-1 font-semibold text-foreground group-hover:text-primary">
          {listing.title}
        </h3>

        {listing.category_name && (
          <p className="mt-1 text-xs text-muted-foreground">
            {listing.category_name}
          </p>
        )}

        {listing.item_location_name && (
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {listing.item_location_name}
          </p>
        )}

        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-xl font-bold text-primary">
            {formatPrice(listing.price_per_day_cents, listing.currency_code)}
          </span>
          <span className="text-sm text-muted-foreground">{t("listings.per_day")}</span>
        </div>

        {listing.price_per_week_cents && (
          <p className="mt-1 text-xs text-muted-foreground">
            {formatPrice(listing.price_per_week_cents, listing.currency_code)}{t("listings_grid.per_week")}
          </p>
        )}
      </div>
    </Link>
  )
}

