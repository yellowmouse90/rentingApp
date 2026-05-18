import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { StripeConnectCard } from "@/components/dashboard/stripe-connect-card"
import { Package, Plus, CreditCard, BarChart3 } from "lucide-react"

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect("/auth/login?redirect=/dashboard")
  }

  // Fetch user stats
  const { data: profile } = await supabase
    .from("profiles")
    .select("*, stripe_account_id, stripe_onboarding_complete")
    .eq("id", user.id)
    .single()

  const { count: listingsCount } = await supabase
    .schema('inventory_domain')
    .from("listings")
    .select("*", { count: "exact", head: true })
    .eq("owner_id", user.id)

  const { count: ordersAsRenter } = await supabase
    .from("rental_orders")
    .select("*", { count: "exact", head: true })
    .eq("renter_id", user.id)

  const { count: ordersAsOwner } = await supabase
    .from("rental_items")
    .select("*", { count: "exact", head: true })
    .eq("owner_id", user.id)

  return (
    <div className="min-h-screen bg-muted/30 py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="mt-1 text-muted-foreground">
              Benvenuto, {profile?.display_name || user.email?.split("@")[0]}
            </p>
          </div>
          <Link
            href="/listings/new"
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90"
          >
            <Plus className="h-4 w-4" />
            Nuovo annuncio
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
                <p className="text-sm text-muted-foreground">I miei annunci</p>
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
                <p className="text-sm text-muted-foreground">Noleggi ricevuti</p>
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
                <p className="text-sm text-muted-foreground">Noleggi effettuati</p>
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

        {/* Quick Links */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link
            href="/dashboard/listings"
            className="flex items-center justify-between rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/50"
          >
            <div>
              <h3 className="font-semibold text-foreground">Gestisci annunci</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Modifica o rimuovi i tuoi annunci
              </p>
            </div>
            <Package className="h-6 w-6 text-muted-foreground" />
          </Link>

          <Link
            href="/bookings"
            className="flex items-center justify-between rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/50"
          >
            <div>
              <h3 className="font-semibold text-foreground">I miei noleggi</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Visualizza le tue prenotazioni
              </p>
            </div>
            <BarChart3 className="h-6 w-6 text-muted-foreground" />
          </Link>
        </div>
      </div>
    </div>
  )
}
