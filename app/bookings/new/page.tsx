import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { requirePageUser } from "@/lib/auth/page"
import { getServerI18n } from "@/lib/i18n/server"
import { formatPrice, calculateDays, calculateRentalPrice, calculateServiceFee } from "@/lib/utils"
import { format } from "date-fns"
import { BookingForm } from "@/components/bookings/booking-form"
import { DbErrorNotice } from "@/components/ui/db-error-notice"
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
  const { t, dateLocale } = await getServerI18n()

  // Check authentication
  const redirectUrl = `/bookings/new?listing=${params.listing}&start=${params.start}&end=${params.end}`
  const { supabase, user } = await requirePageUser(redirectUrl)

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
  const totalToPayNow = subtotal + serviceFee
  const grandTotal = subtotal + serviceFee + deposit

  const { data: ownerProfile, error: ownerProfileError } = await supabase
    .schema("users_domain")
    .from("profiles")
    .select("id, display_name, avatar_url, stripe_account_id, stripe_onboarding_complete")
    .eq("id", listing.owner_id)
    .single()

  const owner = (ownerProfile || {
    id: listing.owner_id,
    display_name: t("booking_new.default_user"),
    avatar_url: null,
    stripe_account_id: null,
    stripe_onboarding_complete: false,
  }) as {
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
      <DbErrorNotice message={ownerProfileError ? `${t("booking_new.owner_profile_error")}: ${ownerProfileError.message}` : null} />
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <Link
          href={`/listings/${listing.id}`}
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          {t("booking_new.back")}
        </Link>

        <h1 className="text-2xl font-bold text-foreground">{t("booking_new.title")}</h1>

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
                    <span className="text-muted-foreground">{t("booking_new.no_img")}</span>
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground line-clamp-2">
                    {listing.title}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("booking_new.by")} {owner.display_name || t("booking_new.default_user")}
                  </p>
                </div>
              </div>

              {/* Dates */}
              <div className="mt-6 flex items-center gap-3 rounded-lg bg-muted p-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-foreground">
                    {format(startDate, "d MMM", { locale: dateLocale })} - {format(endDate, "d MMM yyyy", { locale: dateLocale })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {totalDays} {totalDays === 1 ? t("booking_new.day") : t("booking_new.days")}
                  </p>
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="mt-6 space-y-3 border-t border-border pt-6">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {formatPrice(listing.price_per_day_cents, listing.currency_code)} x {totalDays} {t("booking_new.days")}
                  </span>
                  <span className="text-foreground">{formatPrice(subtotal, listing.currency_code)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("booking_new.service_fee")}</span>
                  <span className="text-foreground">{formatPrice(serviceFee, listing.currency_code)}</span>
                </div>
                {deposit > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("booking_new.deposit_refundable")}</span>
                    <span className="text-foreground">{formatPrice(deposit, listing.currency_code)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-3 font-semibold">
                  <span className="text-foreground">{t("booking_new.total_to_pay")}</span>
                  <span className="text-foreground">{formatPrice(totalToPayNow, listing.currency_code)}</span>
                </div>
                {deposit > 0 && (
                  <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                    <p>
                      {t("booking_new.deposit_separate")} <span className="font-medium text-foreground">{formatPrice(deposit, listing.currency_code)}</span>
                    </p>
                    <p className="mt-1">
                      {t("booking_new.total_authorized")}
                      <span className="ml-1 font-semibold text-foreground">{formatPrice(grandTotal, listing.currency_code)}</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Trust badges */}
              <div className="mt-6 space-y-3 border-t border-border pt-6">
                <div className="flex items-start gap-3 text-sm">
                  <Shield className="mt-0.5 h-4 w-4 text-accent" />
                  <div>
                    <p className="font-medium text-foreground">{t("booking_new.secure_payment")}</p>
                    <p className="text-muted-foreground">{t("booking_new.protected_by_stripe")}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-sm">
                  <Clock className="mt-0.5 h-4 w-4 text-accent" />
                  <div>
                    <p className="font-medium text-foreground">{t("booking_new.free_cancellation")}</p>
                    <p className="text-muted-foreground">{t("booking_new.free_cancellation_until")}</p>
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

