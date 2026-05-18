import { notFound } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { formatPrice, getConditionLabel } from "@/lib/utils"
import { ListingGallery } from "@/components/listings/listing-gallery"
import { BookingCard } from "@/components/listings/booking-card"
import { 
  Star, 
  Shield, 
  MapPin, 
  Calendar, 
  ChevronLeft,
  MessageSquare,
  Share2,
  Heart
} from "lucide-react"

interface ListingDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function ListingDetailPage({ params }: ListingDetailPageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch listing with related data
  const { data: listing, error } = await supabase
    .schema('inventory_domain')
    .from("listings")
    .select(`
      *,
      owner:profiles!listings_owner_id_fkey(
        id, 
        display_name, 
        avatar_url, 
        bio,
        average_rating_as_owner,
        total_reviews_as_owner,
        created_at
      ),
      category:categories(id, name, slug),
      images:listing_images(id, image_url, display_order)
    `)
    .eq("id", id)
    .single()

  if (error || !listing) {
    notFound()
  }

  // Fetch existing bookings to show unavailable dates
  const { data: bookings } = await supabase
    .from("rental_items")
    .select("start_date, end_date, status")
    .eq("listing_id", id)
    .not("status", "in", '("cancelled","unavailable")')

  // Fetch availability exceptions
  const { data: exceptions } = await supabase
    .from("listing_availability_exceptions")
    .select("unavailable_date")
    .eq("listing_id", id)

  const owner = listing.owner as {
    id: string
    display_name: string
    avatar_url: string | null
    bio: string | null
    average_rating_as_owner: number
    total_reviews_as_owner: number
    created_at: string
  }

  const images = (listing.images as { id: string; image_url: string; display_order: number }[])?.sort(
    (a, b) => a.display_order - b.display_order
  ) || []

  const isOwner = user?.id === listing.owner_id

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Back button */}
        <Link
          href="/listings"
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Torna agli annunci
        </Link>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2">
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
                    Cauzione: {formatPrice(listing.deposit_cents, listing.currency_code)}
                  </span>
                )}
              </div>

              {/* Price */}
              <div className="mt-6 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-primary">
                  {formatPrice(listing.price_per_day_cents, listing.currency_code)}
                </span>
                <span className="text-muted-foreground">/giorno</span>
              </div>
              {listing.price_per_week_cents && (
                <p className="mt-1 text-sm text-muted-foreground">
                  oppure {formatPrice(listing.price_per_week_cents, listing.currency_code)}/settimana
                </p>
              )}
            </div>

            {/* Description */}
            <div className="mt-8">
              <h2 className="text-lg font-semibold text-foreground">Descrizione</h2>
              <p className="mt-3 whitespace-pre-wrap text-muted-foreground">
                {listing.description || "Nessuna descrizione disponibile."}
              </p>
            </div>

            {/* Owner Info */}
            <div className="mt-8 rounded-xl border border-border bg-card p-6">
              <h2 className="text-lg font-semibold text-foreground">Proprietario</h2>
              <div className="mt-4 flex items-start gap-4">
                {owner.avatar_url ? (
                  <img
                    src={owner.avatar_url}
                    alt={owner.display_name || "Utente"}
                    className="h-14 w-14 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-lg font-medium text-primary-foreground">
                    {(owner.display_name || "U").slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">
                    {owner.display_name || "Utente"}
                  </h3>
                  <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                    {owner.average_rating_as_owner > 0 && (
                      <span className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                        {owner.average_rating_as_owner.toFixed(1)} ({owner.total_reviews_as_owner} recensioni)
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Membro dal {new Date(owner.created_at).toLocaleDateString("it-IT", { month: "long", year: "numeric" })}
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
                  Contatta {owner.display_name?.split(" ")[0] || "il proprietario"}
                </Link>
              )}
            </div>

            {/* Trust & Safety */}
            <div className="mt-8 rounded-xl border border-border bg-card p-6">
              <div className="flex items-start gap-3">
                <Shield className="mt-0.5 h-5 w-5 text-accent" />
                <div>
                  <h3 className="font-semibold text-foreground">Noleggio sicuro</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Tutti i pagamenti sono protetti. La cauzione viene trattenuta e rilasciata dopo il ritorno dell&apos;attrezzo.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Booking Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
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
