"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"

export function HowItWorksSection() {
  const { t } = useLanguage()

  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
            {t("home.how.title")}
          </h2>
          <p className="mt-2 text-muted-foreground">
            {t("home.how.subtitle")}
          </p>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-3">
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-xl font-bold text-primary">
              1
            </div>
            <h3 className="mt-4 text-lg font-semibold text-foreground">{t("home.how.step1.title")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("home.how.step1.desc")}
            </p>
          </div>
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-xl font-bold text-primary">
              2
            </div>
            <h3 className="mt-4 text-lg font-semibold text-foreground">{t("home.how.step2.title")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("home.how.step2.desc_full")}
            </p>
          </div>
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-xl font-bold text-primary">
              3
            </div>
            <h3 className="mt-4 text-lg font-semibold text-foreground">{t("home.how.step3.title_full")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("home.how.step3.desc_full")}
            </p>
          </div>
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/listings/new"
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 font-medium text-accent-foreground transition-colors hover:bg-accent/90"
          >
            {t("home.how.start_renting")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
