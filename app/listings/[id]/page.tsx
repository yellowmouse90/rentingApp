import { notFound } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getServerI18n } from "@/lib/i18n/server"
import { formatPrice, getConditionLabel } from "@/lib/utils"
import { ListingGallery } from "@/components/listings/listing-gallery"
import { BookingCard } from "@/components/listings/booking-card"
import { 
  Star, 
  Shield, 
  Calendar, 
  ChevronLeft,
  MessageSquare,
  Share2,
  Heart,
  Settings,
  Package,
  ShoppingBag
} from "lucide-react"

interface ListingDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function ListingDetailPage({ params }: ListingDetailPageProps) {
  const { id } = await params
  const { t, intlLocale } = await getServerI18n()
  const supabase = await createClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch listing with related data
  const { data: listing, error } = await supabase
    .schema('inventory_domain')
    .from("listings")
    .select(`
      *,
      category:categories(id, name, slug),
      images:listing_images(id, image_url, display_order)
    `)
    .eq("id", id)
    .single()

  if (error || !listing) {
    notFound()
  }

  const isOwner = user?.id === listing.owner_id

  if (!listing.is_active && !isOwner) {
    notFound()
  }

  // Fetch owner separately to avoid cross-schema embed issues.
  const { data: ownerProfile } = await supabase
    .schema("users_domain")
    .from("user_domain.profiles")
    .select("id, email, display_name, avatar_url, bio, average_rating_as_owner, total_reviews_as_owner, created_at")
    .eq("id", listing.owner_id)
    .maybeSingle()

  let effectiveOwnerProfile = ownerProfile

  // If RLS blocks profile visibility, use a server-side admin fallback for public fields only.
  if (!effectiveOwnerProfile) {
    const admin = createAdminClient()
    const { data: ownerProfileAdmin } = await admin
      .schema("users_domain")
      .from("user_domain.profiles")
      .select("id, email, display_name, avatar_url, bio, average_rating_as_owner, total_reviews_as_owner, created_at")
      .eq("id", listing.owner_id)
      .maybeSingle()

    effectiveOwnerProfile = ownerProfileAdmin || null
  }

  // Fetch existing bookings to show unavailable dates
  const { data: bookings } = await supabase
    .schema("rentals_domain")
    .from("rental_items")
    .select("start_date, end_date, status")
    .eq("listing_id", id)
    .not("status", "in", '("cancelled","unavailable")')

  // Fetch availability exceptions
  const { data: exceptions } = await supabase
    .schema("inventory_domain")
    .from("listing_availability_exceptions")
    .select("unavailable_date")
    .eq("listing_id", id)

  const owner = (effectiveOwnerProfile || {
    id: listing.owner_id,
    email: "",
    display_name: "Utente",
    avatar_url: null,
    bio: null,
    average_rating_as_owner: 0,
    total_reviews_as_owner: 0,
    created_at: new Date().toISOString(),
  }) as {
    id: string
    email: string
    display_name: string
    avatar_url: string | null
    bio: string | null
    average_rating_as_owner: number
    total_reviews_as_owner: number
    created_at: string
  }

  const ownerDisplayName =
    owner.display_name?.trim() ||
    owner.email?.split("@")[0]?.trim() ||
    "Utente"

  const images = (listing.images as { id: string; image_url: string; display_order: number }[])?.sort(
    (a, b) => a.display_order - b.display_order
  ) || []

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Back button */}
        <Link
          href="/listings"
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          {t("listing_detail.back")}
        </Link>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {!listing.is_active && isOwner && (
              <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                {t("listing_detail.archived_notice")}
              </div>
            )}

            {/* Gallery */}
            <ListingGallery images={images} title={listing.title} />

            {/* Title and Quick Info */}
            <div className="mt-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
                    {listing.title}
                  </h1>
                  {listing.category && (
                    <Link
                      href={`/listings?category=${(listing.category as { slug: string }).slug}`}
                      className="mt-1 text-sm text-primary hover:underline"
                    >
                      {(listing.category as { name: string }).name}
                    </Link>
                  )}
                </div>
                <div className="flex gap-2">
                  <button className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
                    <Heart className="h-5 w-5" />
                  </button>
                  <button className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
                    <Share2 className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Badges */}
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                  {getConditionLabel(listing.condition)}
                </span>
                {listing.deposit_cents > 0 && (
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
                    {t("listing_detail.deposit")}: {formatPrice(listing.deposit_cents, listing.currency_code)}
                  </span>
                )}
              </div>

              {/* Price */}
              <div className="mt-6 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-primary">
                  {formatPrice(listing.price_per_day_cents, listing.currency_code)}
                </span>
                <span className="text-muted-foreground">{t("listing_detail.per_day")}</span>
              </div>
              {listing.price_per_week_cents && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("listing_detail.or")} {formatPrice(listing.price_per_week_cents, listing.currency_code)}{t("listing_detail.per_week")}
                </p>
              )}

              {/* Primary actions */}
              <div className="mt-5 flex flex-wrap gap-3">
                {isOwner ? (
                  <>
                    <Link
                      href={`/listings/${listing.id}/edit`}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      <Settings className="h-4 w-4" />
                      Modifica annuncio
                    </Link>
                    <Link
                      href="/dashboard/listings"
                      className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
                    >
                      <Package className="h-4 w-4" />
                      I tuoi annunci
                    </Link>
                  </>
                ) : (
                  <a
                    href="#booking-widget"
                    className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:bg-accent/90"
                  >
                    <ShoppingBag className="h-4 w-4" />
                    Noleggia ora
                  </a>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="mt-8">
              <h2 className="text-lg font-semibold text-foreground">{t("listing_detail.description")}</h2>
              <p className="mt-3 whitespace-pre-wrap text-muted-foreground">
                {listing.description || t("listing_detail.no_description")}
              </p>
            </div>

            {/* Owner Info */}
            <div className="mt-8 rounded-xl border border-border bg-card p-6">
              <h2 className="text-lg font-semibold text-foreground">{t("listing_detail.owner")}</h2>
              <div className="mt-4 flex items-start gap-4">
                {owner.avatar_url ? (
                  <img
                    src={owner.avatar_url}
                    alt={ownerDisplayName}
                    className="h-14 w-14 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-lg font-medium text-primary-foreground">
                    {ownerDisplayName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">
                    {ownerDisplayName}
                  </h3>
                  <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                    {owner.average_rating_as_owner > 0 && (
                      <span className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                        {owner.average_rating_as_owner.toFixed(1)} ({owner.total_reviews_as_owner} {t("listing_detail.reviews")})
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {t("listing_detail.member_since")} {new Date(owner.created_at).toLocaleDateString(intlLocale, { month: "long", year: "numeric" })}
                    </span>
                  </div>
                  {owner.bio && (
                    <p className="mt-2 text-sm text-muted-foreground">{owner.bio}</p>
                  )}
                </div>
              </div>
              {!isOwner && (
                <Link
                  href={`/messages?listing=${listing.id}&user=${owner.id}`}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-border py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  <MessageSquare className="h-4 w-4" />
                  {t("listing_detail.contact_owner")} {ownerDisplayName.split(" ")[0] || t("listing_detail.contact_owner_fallback")}
                </Link>
              )}
            </div>

            {/* Trust & Safety */}
            <div className="mt-8 rounded-xl border border-border bg-card p-6">
              <div className="flex items-start gap-3">
                <Shield className="mt-0.5 h-5 w-5 text-accent" />
                <div>
                  <h3 className="font-semibold text-foreground">{t("listing_detail.safe_rental")}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("listing_detail.safe_rental_desc")}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Booking Sidebar */}
          <div className="lg:col-span-1">
            <div id="booking-widget" className="sticky top-24">
              <BookingCard
                listing={listing}
                bookings={bookings || []}
                exceptions={exceptions || []}
                isOwner={isOwner}
                isLoggedIn={!!user}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
