"use client"

import Link from "next/link"
import { Wrench } from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"

export function Footer() {
  const { t } = useLanguage()

  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Wrench className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold text-foreground">ToolShare</span>
            </Link>
            <p className="mt-3 text-sm text-muted-foreground">
              {t("footer.description")}
            </p>
          </div>

          {/* Links */}
          <div>
            <h3 className="text-sm font-semibold text-foreground">{t("nav.explore")}</h3>
            <ul className="mt-4 space-y-2">
              <li>
                <Link href="/listings" className="text-sm text-muted-foreground hover:text-foreground">
                  {t("footer.all_tools")}
                </Link>
              </li>
              <li>
                <Link href="/categories" className="text-sm text-muted-foreground hover:text-foreground">
                  {t("nav.categories")}
                </Link>
              </li>
              <li>
                <Link href="/how-it-works" className="text-sm text-muted-foreground hover:text-foreground">
                  {t("nav.how_it_works")}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground">{t("footer.account")}</h3>
            <ul className="mt-4 space-y-2">
              <li>
                <Link href="/auth/login" className="text-sm text-muted-foreground hover:text-foreground">
                  {t("nav.login")}
                </Link>
              </li>
              <li>
                <Link href="/auth/sign-up" className="text-sm text-muted-foreground hover:text-foreground">
                  {t("nav.signup")}
                </Link>
              </li>
              <li>
                <Link href="/listings/new" className="text-sm text-muted-foreground hover:text-foreground">
                  {t("nav.publish_listing")}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground">{t("footer.support")}</h3>
            <ul className="mt-4 space-y-2">
              <li>
                <Link href="/help" className="text-sm text-muted-foreground hover:text-foreground">
                  {t("footer.help")}
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground">
                  {t("footer.terms")}
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground">
                  {t("footer.privacy")}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-8">
          <p className="text-center text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} ToolShare. {t("footer.rights")}
          </p>
        </div>
      </div>
    </footer>
  )
}

