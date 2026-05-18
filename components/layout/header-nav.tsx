"use client"

import Link from "next/link"
import { useLanguage } from "@/lib/i18n/language-context"

export function HeaderNav() {
  const { t } = useLanguage()

  return (
    <nav className="hidden items-center gap-6 md:flex">
      <Link
        href="/listings"
        className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        {t("nav.explore")}
      </Link>
      <Link
        href="/categories"
        className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        {t("nav.categories")}
      </Link>
      <Link
        href="/how-it-works"
        className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        {t("nav.how_it_works")}
      </Link>
    </nav>
  )
}
