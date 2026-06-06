"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"

export function CTASection() {
  const { t } = useLanguage()

  return (
    <section className="bg-primary py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-primary-foreground sm:text-3xl">
            {t("home.cta.title")}
          </h2>
          <p className="mt-4 text-primary-foreground/80">
            {t("home.cta.subtitle_full")}
          </p>
          <div className="mt-8">
            <Link
              href="/listings/new"
              className="inline-flex items-center gap-2 rounded-xl bg-background px-6 py-3 font-medium text-foreground transition-colors hover:bg-background/90"
            >
              {t("home.cta.publish_first")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

