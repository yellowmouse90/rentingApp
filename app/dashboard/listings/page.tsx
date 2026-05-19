import Link from "next/link"
import { requirePageUser } from "@/lib/auth/page"
import { getServerI18n } from "@/lib/i18n/server"
import { formatPrice, getConditionLabel } from "@/lib/utils"
import { ListingActions } from "@/components/dashboard/listing-actions"
import { ImageIcon, Plus, Package, ArrowLeft } from "lucide-react"

interface ListingRow {
  id: string
  title: string
  condition: "new" | "like_new" | "good" | "fair"
  price_per_day_cents: number
  currency_code: string
  is_active: boolean
  is_available: boolean
  created_at: string
  category: { name: string }[] | null
  images: { image_url: string; display_order: number }[]
}

export default async function DashboardListingsPage() {
  const { t, intlLocale } = await getServerI18n()
  const { supabase, user } = await requirePageUser("/dashboard/listings")

  const { data: listings } = await supabase
    .schema("inventory_domain")
    .from("listings")
    .select(`
      id,
      title,
      condition,
      price_per_day_cents,
      currency_code,
      is_active,
      is_available,
      created_at,
      category:categories(name),
      images:listing_images(image_url, display_order)
    `)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })

  const rows = (listings || []) as ListingRow[]

  return (
    <div className="min-h-screen bg-muted/30 py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("dashboard_listings.back")}
          </Link>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("dashboard_listings.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("dashboard_listings.subtitle")}
            </p>
          </div>
          <Link
            href="/listings/new"
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90"
          >
            <Plus className="h-4 w-4" />
            {t("dashboard_listings.new_product")}
          </Link>
        </div>

        {rows.length === 0 ? (
          <div className="mt-8 rounded-xl border border-dashed border-border bg-card p-12 text-center">
            <Package className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h2 className="mt-4 text-lg font-semibold text-foreground">{t("dashboard_listings.empty_title")}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("dashboard_listings.empty_desc")}
            </p>
            <Link
              href="/listings/new"
              className="mt-4 inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t("dashboard_listings.publish_product")}
            </Link>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {rows.map((listing) => {
              const firstImage = [...(listing.images || [])].sort(
                (a, b) => a.display_order - b.display_order
              )[0]

              return (
                <article
                  key={listing.id}
                  className="rounded-xl border border-border bg-card p-4 sm:p-5"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="h-28 w-full shrink-0 overflow-hidden rounded-lg bg-muted sm:w-40">
                      {firstImage?.image_url ? (
                        <img
                          src={firstImage.image_url}
                          alt={listing.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-foreground">{listing.title}</h2>
                        {listing.is_active ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            {t("dashboard_listings.active")}
                          </span>
                        ) : (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            {t("dashboard_listings.archived")}
                          </span>
                        )}
                        {!listing.is_available && listing.is_active ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                            {t("dashboard_listings.unavailable")}
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        <span>{getConditionLabel(listing.condition)}</span>
                        {listing.category?.[0]?.name ? <span>{t("dashboard_listings.category")}: {listing.category[0].name}</span> : null}
                        <span>
                          {t("dashboard_listings.created_on")} {new Date(listing.created_at).toLocaleDateString(intlLocale)}
                        </span>
                      </div>

                      <p className="mt-2 text-base font-semibold text-primary">
                        {formatPrice(listing.price_per_day_cents, listing.currency_code)} {t("dashboard_listings.per_day")}
                      </p>

                      <div className="mt-3">
                        <ListingActions listingId={listing.id} isActive={listing.is_active} />
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
