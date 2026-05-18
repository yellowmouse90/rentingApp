"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { Category } from "@/lib/types"
import { formatPrice, getConditionLabel } from "@/lib/utils"
import { LocationSearch } from "./location-search"
import { ListingsFilters } from "./listings-filters"
import { Star, ImageIcon, Package, MapPin, Loader2 } from "lucide-react"

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
  
  const [location, setLocation] = useState<{ lat: number; lng: number; name: string } | null>(
    initialParams.lat && initialParams.lng
      ? { lat: parseFloat(initialParams.lat), lng: parseFloat(initialParams.lng), name: "" }
      : null
  )
  const [radius, setRadius] = useState(initialParams.radius ? parseInt(initialParams.radius) : 50)
  const [listings, setListings] = useState<ListingWithDistance[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)

  const fetchListings = useCallback(async () => {
    setIsLoading(true)

    if (location && location.lat !== 0 && location.lng !== 0) {
      // Use geographic search function
      const { data, error } = await supabase.rpc("search_listings_nearby", {
        user_lat: location.lat,
        user_lng: location.lng,
        radius_km: radius,
        category_slug: initialParams.category || null,
        search_query: initialParams.q || null,
        min_price: initialParams.minPrice ? parseInt(initialParams.minPrice) * 100 : null,
        max_price: initialParams.maxPrice ? parseInt(initialParams.maxPrice) * 100 : null,
        item_condition: initialParams.condition || null,
        page_limit: 50,
        page_offset: 0,
      })

      if (!error && data) {
        setListings(data)
        setTotalCount(data.length)
      } else {
        console.error("[v0] Error fetching listings:", error)
        setListings([])
        setTotalCount(0)
      }
    } else {
      // Fallback to regular query without location
      let query = supabase
        .from("listings")
        .select(`
          *,
          owner:profiles!listings_owner_id_fkey(id, display_name, avatar_url, average_rating_as_owner),
          category:categories(id, name, slug, icon_name),
          images:listing_images(id, image_url, display_order)
        `, { count: "exact" })
        .eq("is_active", true)
        .eq("is_available", true)

      if (initialParams.q) {
        query = query.ilike("title", `%${initialParams.q}%`)
      }

      if (initialParams.category) {
        const cat = categories.find(c => c.slug === initialParams.category)
        if (cat) {
          query = query.eq("category_id", cat.id)
        }
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

      query = query.order("created_at", { ascending: false }).limit(50)

      const { data, count, error } = await query

      if (!error && data) {
        // Transform to match ListingWithDistance structure
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
          distance_km: -1, // No distance without location
          owner_display_name: listing.owner?.display_name || "Utente",
          owner_avatar_url: listing.owner?.avatar_url || null,
          owner_rating: listing.owner?.average_rating_as_owner || 0,
          category_name: listing.category?.name || "",
          category_icon: listing.category?.icon_name || "",
          first_image_url: listing.images?.sort((a: any, b: any) => a.display_order - b.display_order)[0]?.image_url || null,
        }))
        setListings(transformed)
        setTotalCount(count || transformed.length)
      } else {
        setListings([])
        setTotalCount(0)
      }
    }

    setIsLoading(false)
  }, [location, radius, initialParams, supabase, categories])

  useEffect(() => {
    fetchListings()
  }, [fetchListings])

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
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {isLoading ? (
              "Caricamento..."
            ) : (
              <>
                <span className="font-semibold text-foreground">{totalCount}</span> risultati
                {location && location.lat !== 0 && (
                  <> entro <span className="font-semibold text-foreground">{radius} km</span> da {location.name}</>
                )}
              </>
            )}
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : listings.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
            <Package className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold text-foreground">Nessun risultato</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {location && location.lat !== 0
                ? "Prova ad aumentare il raggio di ricerca o a modificare i filtri"
                : "Abilita la geolocalizzazione per vedere gli attrezzi vicino a te"}
            </p>
            <Link
              href="/listings"
              className="mt-4 inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Vedi tutti gli annunci
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} showDistance={location !== null && location.lat !== 0} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function ListingCard({ listing, showDistance }: { listing: ListingWithDistance; showDistance: boolean }) {
  return (
    <Link
      href={`/listings/${listing.id}`}
      className="group overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-primary/50 hover:shadow-lg"
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
            {getConditionLabel(listing.condition)}
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
          <span className="text-sm text-muted-foreground">/giorno</span>
        </div>

        {listing.price_per_week_cents && (
          <p className="mt-1 text-xs text-muted-foreground">
            {formatPrice(listing.price_per_week_cents, listing.currency_code)}/settimana
          </p>
        )}

        <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
          {listing.owner_avatar_url ? (
            <img
              src={listing.owner_avatar_url}
              alt={listing.owner_display_name || "Utente"}
              className="h-6 w-6 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
              {(listing.owner_display_name || "U").slice(0, 2).toUpperCase()}
            </div>
          )}
          <span className="flex-1 truncate text-xs text-muted-foreground">
            {listing.owner_display_name || "Utente"}
          </span>
          {listing.owner_rating > 0 && (
            <div className="flex items-center gap-0.5 text-xs text-muted-foreground">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {listing.owner_rating.toFixed(1)}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
