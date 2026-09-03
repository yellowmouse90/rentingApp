import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { createClient } from "@/lib/supabase/server"
import { getServerI18n } from "@/lib/i18n/server"
import { formatPrice, getConditionLabel } from "@/lib/utils"
import { SITE_NAME } from "@/lib/seo"
import { DbErrorNotice } from "@/components/ui/db-error-notice"
import { ReviewsSection } from "@/components/reviews/reviews-section"
import { deriveReviewContext } from "@/lib/reviews/rules"
import { Star, Calendar, ChevronLeft, ImageIcon, Package } from "lucide-react"
import type { Listing } from "@/lib/types"

interface UserProfilePageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: UserProfilePageProps): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()

  const { data: profile } = await supabase
    .schema("users_domain")
    .from("profiles")
    .select("display_name, bio, avatar_url")
    .eq("id", id)
    .maybeSingle()

  if (!profile) return {}

  const name = profile.display_name?.trim() || SITE_NAME
  const description =
    profile.bio?.slice(0, 155) || `Scopri gli attrezzi a noleggio di ${name} su ${SITE_NAME}.`

  return {
    title: `${name} · ${SITE_NAME}`,
    description,
    openGraph: {
      title: name,
      description,
      images: profile.avatar_url ? [{ url: profile.avatar_url }] : undefined,
    },
  }
}

export default async function UserProfilePage({ params }: UserProfilePageProps) {
  const { id } = await params
  const { t, intlLocale } = await getServerI18n()
  const supabase = await createClient()

  const dbErrors: string[] = []

  const { data: profile, error: profileError } = await supabase
    .schema("users_domain")
    .from("profiles")
    .select(
      "id, display_name, email, avatar_url, bio, account_type, average_rating_as_owner, total_reviews_as_owner, created_at"
    )
    .eq("id", id)
    .maybeSingle()

  if (profileError) dbErrors.push(`${t("public_profile.profile_error")}: ${profileError.message}`)

  if (!profile) {
    notFound()
  }

  const { data: listings, error: listingsError } = await supabase
    .schema("inventory_domain")
    .from("listings")
    .select(
      `
      *,
      category:categories(id, name, slug),
      images:listing_images(id, image_url, display_order)
    `
    )
    .eq("owner_id", id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })

  if (listingsError) dbErrors.push(`${t("public_profile.listings_error")}: ${listingsError.message}`)

  const displayName =
    profile.display_name?.trim() || profile.email?.split("@")[0]?.trim() || t("listing_detail.default_user")

  const items = (listings || []) as Listing[]

  return (
    <div className="min-h-screen bg-background">
      <DbErrorNotice message={dbErrors.length ? dbErrors.join(" | ") : null} />
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <Link
          href="/listings"
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          {t("listing_detail.back")}
        </Link>

        {/* Profile header */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={displayName}
                className="h-20 w-20 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-2xl font-medium text-primary-foreground">
                {displayName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="flex-1">
              <h1 className="font-heading text-2xl font-bold tracking-[-0.01em] text-foreground sm:text-3xl">
                {displayName}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {profile.average_rating_as_owner > 0 && (
                  <span className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    {profile.average_rating_as_owner.toFixed(1)} ({profile.total_reviews_as_owner}{" "}
                    {t("listing_detail.reviews")})
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {t("listing_detail.member_since")}{" "}
                  {new Date(profile.created_at).toLocaleDateString(intlLocale, {
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
              {profile.bio && <p className="mt-3 text-sm text-muted-foreground">{profile.bio}</p>}
            </div>
          </div>

          {/* Summary stats */}
          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border pt-6 sm:grid-cols-3">
            <div>
              <p className="text-2xl font-bold text-foreground">{items.length}</p>
              <p className="text-sm text-muted-foreground">{t("public_profile.tools_count")}</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {profile.average_rating_as_owner > 0 ? profile.average_rating_as_owner.toFixed(1) : "—"}
              </p>
              <p className="text-sm text-muted-foreground">{t("public_profile.avg_rating")}</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{profile.total_reviews_as_owner}</p>
              <p className="text-sm text-muted-foreground">{t("listing_detail.reviews")}</p>
            </div>
          </div>
        </div>

        {/* Reviews - context follows this profile's own account_type
            (business -> ferramenta, individual -> p2p, see
            lib/reviews/rules.ts) rather than being hardcoded, since the
            platform currently runs pure P2P (no ferramenta accounts) and
            hardcoding 'ferramenta' here would leave this list empty
            forever. average_rating_as_owner above already aggregates
            across every context; this section shows the individual
            reviews and tag breakdown behind it for whichever channel this
            profile actually reviews on as a lender. */}
        <ReviewsSection
          userId={profile.id}
          role="lender"
          context={deriveReviewContext((profile.account_type as "individual" | "business") ?? "individual")}
        />

        {/* Listings */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-foreground">{t("public_profile.tools_heading")}</h2>
          {items.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-border bg-card p-12 text-center">
              <Package className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-sm text-muted-foreground">{t("public_profile.no_tools")}</p>
            </div>
          ) : (
            <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((listing) => {
                const mainImage = listing.images
                  ?.slice()
                  .sort((a, b) => a.display_order - b.display_order)[0]
                const categoryName = (listing.category as { name: string } | undefined)?.name

                return (
                  <Link
                    key={listing.id}
                    href={`/listings/${listing.id}`}
                    className="group overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-primary/50 hover:shadow-lg"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                      {mainImage ? (
                        <Image
                          src={mainImage.image_url}
                          alt={listing.title}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
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
                    </div>
                    <div className="p-4">
                      <h3 className="line-clamp-1 font-semibold text-foreground group-hover:text-primary">
                        {listing.title}
                      </h3>
                      {categoryName && (
                        <p className="mt-1 text-xs text-muted-foreground">{categoryName}</p>
                      )}
                      <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-xl font-bold text-primary">
                          {formatPrice(listing.price_per_day_cents, listing.currency_code)}
                        </span>
                        <span className="text-sm text-muted-foreground">{t("listing_detail.per_day")}</span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
