"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"

interface Listing {
  id: string
  title: string
  price_per_day_cents: number
  currency_code: string
  images?: { image_url: string }[]
  owner?: { display_name: string; avatar_url?: string }
  category?: { name: string }
}

interface FeaturedSectionProps {
  listings: Listing[]
}

export function FeaturedSection({ listings }: FeaturedSectionProps) {
  const { t } = useLanguage()

  const formatPrice = (cents: number, currency: string) => {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: currency || "EUR",
    }).format(cents / 100)
  }

  return (
    <section className="bg-muted/30 py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="font-heading text-2xl font-bold tracking-[-0.01em] text-foreground sm:text-3xl">
              {t("home.featured.title")}
            </h2>
            <p className="mt-2 text-muted-foreground">
              {t("home.featured.subtitle")}
            </p>
          </div>
          <Link
            href="/listings"
            className="hidden items-center gap-1 text-sm font-medium text-primary hover:underline sm:flex"
          >
            {t("home.featured.view_all")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {listings?.map((listing) => (
            <Link
              key={listing.id}
              href={`/listings/${listing.id}`}
              className="group overflow-hidden rounded-2xl border border-border bg-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/5"
            >
              <div className="aspect-[4/3] overflow-hidden bg-muted">
                {listing.images?.[0]?.image_url ? (
                  <img
                    src={listing.images[0].image_url}
                    alt={listing.title}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-4xl">🔧</div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-medium text-foreground line-clamp-1">{listing.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{listing.category?.name}</p>
                <p className="mt-2 font-semibold text-primary">
                  {formatPrice(listing.price_per_day_cents, listing.currency_code)}{t("listings.per_day")}
                </p>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-8 text-center sm:hidden">
          <Link
            href="/listings"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            {t("home.featured.view_all_listings")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}

