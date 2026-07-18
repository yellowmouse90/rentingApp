import Link from "next/link"
import { requirePageUser } from "@/lib/auth/page"
import { getServerI18n } from "@/lib/i18n/server"
import { StripeConnectCard } from "@/components/dashboard/stripe-connect-card"
import { DbErrorNotice } from "@/components/ui/db-error-notice"
import { Package, Plus, CreditCard, BarChart3, ArrowRight } from "lucide-react"

export default async function DashboardPage() {
  const { t } = await getServerI18n()
  const { supabase, user } = await requirePageUser("/dashboard")

  const dbErrors: string[] = []

  // Fetch user stats
  const { data: profile, error: profileError } = await supabase
    .schema("users_domain")
    .from("profiles")
    .select("*, stripe_account_id, stripe_onboarding_complete")
    .eq("id", user.id)
    .single()
  if (profileError) dbErrors.push(`${t("dashboard.errors.profile")}: ${profileError.message}`)

  const { count: listingsCount, error: listingsError } = await supabase
    .schema('inventory_domain')
    .from("listings")
    .select("*", { count: "exact", head: true })
    .eq("owner_id", user.id)
  if (listingsError) dbErrors.push(`${t("dashboard.errors.listings")}: ${listingsError.message}`)

  const { count: ordersAsRenter, error: renterOrdersError } = await supabase
    .schema("rentals_domain")
    .from("rental_orders")
    .select("*", { count: "exact", head: true })
    .eq("renter_id", user.id)
  if (renterOrdersError) dbErrors.push(`${t("dashboard.errors.renter_orders")}: ${renterOrdersError.message}`)

  const { count: ordersAsOwner, error: ownerOrdersError } = await supabase
    .schema("rentals_domain")
    .from("rental_items")
    .select("*", { count: "exact", head: true })
    .eq("owner_id", user.id)
  if (ownerOrdersError) dbErrors.push(`${t("dashboard.errors.owner_orders")}: ${ownerOrdersError.message}`)

  return (
    <div className="min-h-screen bg-muted/30 py-8">
      <DbErrorNotice message={dbErrors.length ? dbErrors.join(" | ") : null} />
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="mt-1 text-muted-foreground">
              {t("dashboard.welcome")}, {profile?.display_name || user.email?.split("@")[0]}
            </p>
          </div>
          <Link
            href="/listings/new"
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90"
          >
            <Plus className="h-4 w-4" />
            {t("dashboard.new_listing")}
          </Link>
        </div>

        {/* Stats */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{listingsCount || 0}</p>
                <p className="text-sm text-muted-foreground">{t("dashboard.my_listings")}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                <BarChart3 className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{ordersAsOwner || 0}</p>
                <p className="text-sm text-muted-foreground">{t("dashboard.received_rentals")}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <CreditCard className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{ordersAsRenter || 0}</p>
                <p className="text-sm text-muted-foreground">{t("dashboard.made_rentals")}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stripe Connect Card */}
        <div className="mt-8">
          <StripeConnectCard
            hasAccount={!!profile?.stripe_account_id}
            onboardingComplete={profile?.stripe_onboarding_complete || false}
          />
        </div>

        {/* Payments page link */}
        <div className="mt-4">
          <Link
            href="/dashboard/payments"
            className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
          >
            {t("dashboard.payments.quick_link")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Quick Links */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link
            href="/dashboard/listings"
            className="flex items-center justify-between rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/50"
          >
            <div>
              <h3 className="font-semibold text-foreground">{t("dashboard.manage_listings.title")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("dashboard.manage_listings.desc")}
              </p>
            </div>
            <Package className="h-6 w-6 text-muted-foreground" />
          </Link>

          <Link
            href="/bookings"
            className="flex items-center justify-between rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/50"
          >
            <div>
              <h3 className="font-semibold text-foreground">{t("dashboard.my_rentals.title")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("dashboard.my_rentals.desc")}
              </p>
            </div>
            <BarChart3 className="h-6 w-6 text-muted-foreground" />
          </Link>
        </div>
      </div>
    </div>
  )
}

