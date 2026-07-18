"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"
import type { Category } from "@/lib/types"

interface CategorySectionProps {
  categories: Category[]
}

export function CategorySection({ categories }: CategorySectionProps) {
  const { t, tCategory } = useLanguage()

  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="font-heading text-2xl font-bold tracking-[-0.01em] text-foreground sm:text-3xl">
              {t("home.categories.title")}
            </h2>
            <p className="mt-2 text-muted-foreground">
              {t("home.categories.subtitle")}
            </p>
          </div>
          <Link
            href="/categories"
            className="hidden items-center gap-1 text-sm font-medium text-primary hover:underline sm:flex"
          >
            {t("home.categories.all")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {categories?.slice(0, 10).map((category) => (
            <Link
              key={category.id}
              href={`/listings?category=${category.slug}`}
              className="group flex flex-col items-center rounded-2xl border border-border bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-2xl transition-colors group-hover:bg-primary/20">
                {category.icon_name || "🔧"}
              </div>
              <span className="mt-3 text-center text-sm font-medium text-foreground">
                {tCategory(category.id, category.name)}
              </span>
            </Link>
          ))}
        </div>

        <div className="mt-6 text-center sm:hidden">
          <Link
            href="/categories"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            {t("home.categories.all")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}

