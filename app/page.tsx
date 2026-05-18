import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { ArrowRight, Shield, Clock, Wallet, Search } from "lucide-react"
import { CategoryGrid } from "@/components/home/category-grid"
import { FeaturedListings } from "@/components/home/featured-listings"

export default async function HomePage() {
  const supabase = await createClient()

  // Fetch categories
  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .order("name")

  // Fetch featured listings
  const { data: listings } = await supabase
    .from("listings")
    .select(`
      *,
      owner:profiles!listings_owner_id_fkey(id, display_name, avatar_url, average_rating_as_owner),
      category:categories(name, slug),
      images:listing_images(id, image_url, display_order)
    `)
    .eq("is_active", true)
    .eq("is_available", true)
    .order("created_at", { ascending: false })
    .limit(8)

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-accent/5 py-20 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Noleggia attrezzi dai tuoi vicini
            </h1>
            <p className="mt-6 text-pretty text-lg text-muted-foreground sm:text-xl">
              ToolShare connette chi ha bisogno di un attrezzo con chi lo possiede. Risparmia denaro, riduci gli sprechi e conosci la tua comunita.
            </p>

            {/* Search Bar */}
            <div className="mt-10">
              <form action="/listings" method="GET" className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    name="q"
                    placeholder="Cerca un attrezzo... (es. trapano, tagliaerba)"
                    className="w-full rounded-xl border border-input bg-background py-4 pl-12 pr-4 text-foreground shadow-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-4 font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                >
                  Cerca
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            </div>

            {/* Quick Stats */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-accent" />
                <span>Pagamenti sicuri</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-accent" />
                <span>Disponibilita immediata</span>
              </div>
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-accent" />
                <span>Risparmio garantito</span>
              </div>
            </div>
          </div>
        </div>

        {/* Background decoration */}
        <div className="absolute -top-40 right-0 -z-10 h-[500px] w-[500px] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 left-0 -z-10 h-[500px] w-[500px] rounded-full bg-accent/5 blur-3xl" />
      </section>

      {/* Categories Section */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
                Esplora per categoria
              </h2>
              <p className="mt-2 text-muted-foreground">
                Trova l&apos;attrezzo giusto per ogni lavoro
              </p>
            </div>
            <Link
              href="/categories"
              className="hidden items-center gap-1 text-sm font-medium text-primary hover:underline sm:flex"
            >
              Tutte le categorie
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <CategoryGrid categories={categories || []} />

          <div className="mt-6 text-center sm:hidden">
            <Link
              href="/categories"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Tutte le categorie
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Listings Section */}
      <section className="bg-muted/30 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
                Annunci recenti
              </h2>
              <p className="mt-2 text-muted-foreground">
                Gli ultimi attrezzi aggiunti dalla community
              </p>
            </div>
            <Link
              href="/listings"
              className="hidden items-center gap-1 text-sm font-medium text-primary hover:underline sm:flex"
            >
              Vedi tutti
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <FeaturedListings listings={listings || []} />

          <div className="mt-8 text-center sm:hidden">
            <Link
              href="/listings"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Vedi tutti gli annunci
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* How it works Section */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
              Come funziona
            </h2>
            <p className="mt-2 text-muted-foreground">
              Noleggiare e semplice, sicuro e veloce
            </p>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-xl font-bold text-primary">
                1
              </div>
              <h3 className="mt-4 text-lg font-semibold text-foreground">Cerca</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Trova l&apos;attrezzo che ti serve tra migliaia di annunci nella tua zona
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-xl font-bold text-primary">
                2
              </div>
              <h3 className="mt-4 text-lg font-semibold text-foreground">Prenota</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Scegli le date, contatta il proprietario e conferma il noleggio
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-xl font-bold text-primary">
                3
              </div>
              <h3 className="mt-4 text-lg font-semibold text-foreground">Usa e restituisci</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Ritira l&apos;attrezzo, usalo per il tuo progetto e restituiscilo
              </p>
            </div>
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/listings/new"
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 font-medium text-accent-foreground transition-colors hover:bg-accent/90"
            >
              Inizia a noleggiare
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-primary py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold text-primary-foreground sm:text-3xl">
              Hai attrezzi che non usi?
            </h2>
            <p className="mt-4 text-primary-foreground/80">
              Mettili a reddito! Guadagna condividendo i tuoi attrezzi con chi ne ha bisogno.
            </p>
            <div className="mt-8">
              <Link
                href="/listings/new"
                className="inline-flex items-center gap-2 rounded-xl bg-background px-6 py-3 font-medium text-foreground transition-colors hover:bg-background/90"
              >
                Pubblica il tuo primo annuncio
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
