import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { formatPrice, calculateDays, calculateRentalPrice, calculateServiceFee } from "@/lib/utils"
import { format } from "date-fns"
import { it } from "date-fns/locale"
import { BookingForm } from "@/components/bookings/booking-form"
import { ChevronLeft, Calendar, Shield, Clock } from "lucide-react"

interface NewBookingPageProps {
  searchParams: Promise<{
    listing?: string
    start?: string
    end?: string
  }>
}

export default async function NewBookingPage({ searchParams }: NewBookingPageProps) {
  const params = await searchParams
  const supabase = await createClient()

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    const redirectUrl = `/bookings/new?listing=${params.listing}&start=${params.start}&end=${params.end}`
    redirect(`/auth/login?redirect=${encodeURIComponent(redirectUrl)}`)
  }

  // Validate parameters
  if (!params.listing || !params.start || !params.end) {
    redirect("/listings")
  }

  // Fetch listing
  const { data: listing, error } = await supabase
    .schema('inventory_domain')
    .from("listings")
    .select(`
      *,
      owner:profiles!listings_owner_id_fkey(id, display_name, avatar_url, stripe_account_id, stripe_onboarding_complete),
      images:listing_images(id, image_url, display_order)
    `)
    .eq("id", params.listing)
    .eq("is_active", true)
    .single()

  if (error || !listing) {
    notFound()
  }

  // Can't book own listing
  if (listing.owner_id === user.id) {
    redirect(`/listings/${listing.id}`)
  }

  // Parse dates
  const startDate = new Date(params.start)
  const endDate = new Date(params.end)

  // Calculate pricing
  const totalDays = calculateDays(startDate, endDate)
  const subtotal = calculateRentalPrice(listing.price_per_day_cents, listing.price_per_week_cents, totalDays)
  const serviceFee = calculateServiceFee(subtotal)
  const deposit = listing.deposit_cents
  const grandTotal = subtotal + serviceFee + deposit

  const owner = listing.owner as { 
    id: string
    display_name: string
    avatar_url: string | null
    stripe_account_id: string | null
    stripe_onboarding_complete: boolean
  }

  const mainImage = (listing.images as { image_url: string; display_order: number }[])?.sort(
    (a, b) => a.display_order - b.display_order
  )[0]

  return (
    <div className="min-h-screen bg-muted/30 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <Link
          href={`/listings/${listing.id}`}
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Torna all&apos;annuncio
        </Link>

        <h1 className="text-2xl font-bold text-foreground">Conferma prenotazione</h1>

        <div className="mt-8 grid gap-8 lg:grid-cols-5">
          {/* Booking Form */}
          <div className="lg:col-span-3">
            <BookingForm
              listing={listing}
              owner={owner}
              startDate={startDate}
              endDate={endDate}
              totalDays={totalDays}
              subtotal={subtotal}
              serviceFee={serviceFee}
              deposit={deposit}
              grandTotal={grandTotal}
            />
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-2">
            <div className="sticky top-24 rounded-xl border border-border bg-card p-6">
              {/* Listing Preview */}
              <div className="flex gap-4">
                {mainImage ? (
                  <img
                    src={mainImage.image_url}
                    alt={listing.title}
                    className="h-20 w-20 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-muted">
                    <span className="text-muted-foreground">No img</span>
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground line-clamp-2">
                    {listing.title}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    di {owner.display_name || "Utente"}
                  </p>
                </div>
              </div>

              {/* Dates */}
              <div className="mt-6 flex items-center gap-3 rounded-lg bg-muted p-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-foreground">
                    {format(startDate, "d MMM", { locale: it })} - {format(endDate, "d MMM yyyy", { locale: it })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {totalDays} {totalDays === 1 ? "giorno" : "giorni"}
                  </p>
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="mt-6 space-y-3 border-t border-border pt-6">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {formatPrice(listing.price_per_day_cents, listing.currency_code)} x {totalDays} giorni
                  </span>
                  <span className="text-foreground">{formatPrice(subtotal, listing.currency_code)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Commissione servizio</span>
                  <span className="text-foreground">{formatPrice(serviceFee, listing.currency_code)}</span>
                </div>
                {deposit > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Cauzione (rimborsabile)</span>
                    <span className="text-foreground">{formatPrice(deposit, listing.currency_code)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-3 font-semibold">
                  <span className="text-foreground">Totale</span>
                  <span className="text-foreground">{formatPrice(grandTotal, listing.currency_code)}</span>
                </div>
              </div>

              {/* Trust badges */}
              <div className="mt-6 space-y-3 border-t border-border pt-6">
                <div className="flex items-start gap-3 text-sm">
                  <Shield className="mt-0.5 h-4 w-4 text-accent" />
                  <div>
                    <p className="font-medium text-foreground">Pagamento sicuro</p>
                    <p className="text-muted-foreground">Protetto da Stripe</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-sm">
                  <Clock className="mt-0.5 h-4 w-4 text-accent" />
                  <div>
                    <p className="font-medium text-foreground">Cancellazione gratuita</p>
                    <p className="text-muted-foreground">Fino a 24h prima</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
