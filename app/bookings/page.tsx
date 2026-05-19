import Link from "next/link"
import { requirePageUser } from "@/lib/auth/page"
import { getServerI18n } from "@/lib/i18n/server"
import { formatPrice, getRentalStatusLabel, getRentalStatusColor } from "@/lib/utils"
import { format } from "date-fns"
import type { Locale } from "date-fns"
import { Calendar, Package, ChevronRight, ImageIcon } from "lucide-react"

export default async function BookingsPage() {
  const { t, dateLocale } = await getServerI18n()
  const { supabase, user } = await requirePageUser("/bookings")

  // Fetch user's rental orders (as renter)
  const { data: orders } = await supabase
    .from("rental_orders")
    .select(`
      *,
      items:rental_items(
        *,
        listing:listings(
          id,
          title,
          images:listing_images(image_url, display_order)
        ),
        owner:profiles!rental_items_owner_id_fkey(display_name, avatar_url)
      )
    `)
    .eq("renter_id", user.id)
    .order("created_at", { ascending: false })

  // Fetch rental items where user is owner
  const { data: ownerItems } = await supabase
    .from("rental_items")
    .select(`
      *,
      listing:listings(id, title, images:listing_images(image_url, display_order)),
      order:rental_orders(
        id,
        renter:profiles!rental_orders_renter_id_fkey(display_name, avatar_url)
      )
    `)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })

  return (
    <div className="min-h-screen bg-muted/30 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <h1 className="text-2xl font-bold text-foreground">{t("bookings.title")}</h1>

        {/* As Renter */}
        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Package className="h-5 w-5" />
            {t("bookings.made")}
          </h2>

          {orders && orders.length > 0 ? (
            <div className="mt-4 space-y-4">
              {orders.map((order) => (
                <OrderCard key={order.id} order={order} t={t} dateLocale={dateLocale} />
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-border bg-card p-8 text-center">
              <Package className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-3 text-muted-foreground">{t("bookings.made_empty")}</p>
              <Link
                href="/listings"
                className="mt-4 inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                {t("bookings.explore")}
              </Link>
            </div>
          )}
        </section>

        {/* As Owner */}
        <section className="mt-12">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Calendar className="h-5 w-5" />
            {t("bookings.received")}
          </h2>

          {ownerItems && ownerItems.length > 0 ? (
            <div className="mt-4 space-y-4">
              {ownerItems.map((item) => (
                <OwnerItemCard key={item.id} item={item} t={t} dateLocale={dateLocale} />
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-border bg-card p-8 text-center">
              <Calendar className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-3 text-muted-foreground">{t("bookings.received_empty")}</p>
              <Link
                href="/listings/new"
                className="mt-4 inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90"
              >
                {t("bookings.publish_listing")}
              </Link>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function OrderCard({
  order,
  t,
  dateLocale,
}: {
  order: any
  t: (key: string) => string
  dateLocale: Locale
}) {
  const item = order.items?.[0]
  const listing = item?.listing
  const mainImage = listing?.images?.sort((a: any, b: any) => a.display_order - b.display_order)[0]

  return (
    <Link
      href={`/bookings/${order.id}`}
      className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50"
    >
      {mainImage ? (
        <img
          src={mainImage.image_url}
          alt={listing?.title || t("bookings.removed_listing")}
          className="h-20 w-20 rounded-lg object-cover"
        />
      ) : (
        <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-muted">
          <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-foreground truncate">
          {listing?.title || t("bookings.removed_listing")}
        </h3>
        <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          {format(new Date(item?.start_date), "d MMM", { locale: dateLocale })} -{" "}
          {format(new Date(item?.end_date), "d MMM yyyy", { locale: dateLocale })}
        </div>
        <div className="mt-2 flex items-center gap-3">
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getRentalStatusColor(order.status)}`}>
            {getRentalStatusLabel(order.status)}
          </span>
          <span className="text-sm font-medium text-foreground">
            {formatPrice(order.grand_total_cents, order.currency_code)}
          </span>
        </div>
      </div>

      <ChevronRight className="h-5 w-5 text-muted-foreground" />
    </Link>
  )
}

function OwnerItemCard({
  item,
  t,
  dateLocale,
}: {
  item: any
  t: (key: string) => string
  dateLocale: Locale
}) {
  const listing = item.listing
  const renter = item.order?.renter
  const mainImage = listing?.images?.sort((a: any, b: any) => a.display_order - b.display_order)[0]

  return (
    <Link
      href={`/bookings/${item.order_id}`}
      className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50"
    >
      {mainImage ? (
        <img
          src={mainImage.image_url}
          alt={listing?.title || t("bookings.removed_listing")}
          className="h-20 w-20 rounded-lg object-cover"
        />
      ) : (
        <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-muted">
          <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-foreground truncate">
          {listing?.title || t("bookings.removed_listing")}
        </h3>
        <div className="mt-1 text-sm text-muted-foreground">
          {t("bookings.request_from")} {renter?.display_name || "Utente"}
        </div>
        <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          {format(new Date(item.start_date), "d MMM", { locale: dateLocale })} -{" "}
          {format(new Date(item.end_date), "d MMM yyyy", { locale: dateLocale })}
        </div>
        <div className="mt-2">
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getRentalStatusColor(item.status)}`}>
            {getRentalStatusLabel(item.status)}
          </span>
        </div>
      </div>

      <ChevronRight className="h-5 w-5 text-muted-foreground" />
    </Link>
  )
}
