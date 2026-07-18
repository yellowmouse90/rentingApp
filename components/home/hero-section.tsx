"use client"

import Link from "next/link"
import { ArrowRight, Shield, Clock, Wallet, Search } from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"

export function HeroSection() {
  const { t } = useLanguage()

  return (
    <section className="relative overflow-hidden py-20 sm:py-32">
      <div
        aria-hidden
        className="bg-dot-grid absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_60%_80%_at_50%_0%,black_40%,transparent_100%)]"
      />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-balance font-heading text-4xl font-bold tracking-[-0.02em] text-foreground sm:text-5xl lg:text-6xl">
            {t("home.hero.title")}
          </h1>
          <p className="mt-6 text-pretty text-lg text-muted-foreground sm:text-xl">
            {t("home.hero.subtitle")}
          </p>

          {/* Search Bar */}
          <div className="mt-10">
            <form action="/listings" method="GET" className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  name="q"
                  placeholder={t("home.hero.search_example")}
                  className="w-full rounded-xl border border-input bg-background py-4 pl-12 pr-4 text-foreground shadow-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-4 font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
              >
                {t("home.hero.search_button")}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>

          {/* Quick Stats */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-accent" />
              <span>{t("home.hero.secure_payments")}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-accent" />
              <span>{t("home.hero.immediate_availability")}</span>
            </div>
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-accent" />
              <span>{t("home.hero.guaranteed_savings")}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

