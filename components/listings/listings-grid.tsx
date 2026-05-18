import Link from "next/link"
import type { Listing } from "@/lib/types"
import { formatPrice, getConditionLabel } from "@/lib/utils"
import { Star, ImageIcon, Package } from "lucide-react"

interface ListingsGridProps {
  listings: Listing[]
}

export function ListingsGrid({ listings }: ListingsGridProps) {
  if (listings.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
        <Package className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-semibold text-foreground">Nessun risultato</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Prova a modificare i filtri o la ricerca
        </p>
        <Link
          href="/listings"
          className="mt-4 inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Vedi tutti gli annunci
        </Link>
      </div>
    )
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {listings.map((listing) => (
        <ListingCard key={listing.id} listing={listing} />
      ))}
    </div>
  )
}

function ListingCard({ listing }: { listing: Listing }) {
  const mainImage = listing.images?.sort((a, b) => a.display_order - b.display_order)[0]
  const owner = listing.owner as { id: string; display_name: string; avatar_url: string | null; average_rating_as_owner: number } | undefined

  return (
    <Link
      href={`/listings/${listing.id}`}
      className="group overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-primary/50 hover:shadow-lg"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {mainImage ? (
          <img
            src={mainImage.image_url}
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
        {listing.deposit_cents > 0 && (
          <div className="absolute right-2 top-2">
            <span className="rounded-md bg-amber-500/90 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
              Cauzione
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="line-clamp-1 font-semibold text-foreground group-hover:text-primary">
          {listing.title}
        </h3>

        {listing.category && (
          <p className="mt-1 text-xs text-muted-foreground">
            {(listing.category as { name: string }).name}
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

        {owner && (
          <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
            {owner.avatar_url ? (
              <img
                src={owner.avatar_url}
                alt={owner.display_name || "Utente"}
                className="h-6 w-6 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                {(owner.display_name || "U").slice(0, 2).toUpperCase()}
              </div>
            )}
            <span className="flex-1 truncate text-xs text-muted-foreground">
              {owner.display_name || "Utente"}
            </span>
            {owner.average_rating_as_owner > 0 && (
              <div className="flex items-center gap-0.5 text-xs text-muted-foreground">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {owner.average_rating_as_owner.toFixed(1)}
              </div>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}
