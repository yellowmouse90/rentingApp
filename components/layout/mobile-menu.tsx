"use client"

import { useState } from "react"
import Link from "next/link"
import { User } from "@supabase/supabase-js"
import { Menu, X, Plus, MessageSquare, User as UserIcon, Settings, LogOut, Wrench, Package } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useUnreadMessageCount } from "@/lib/chat/use-unread-count"
import type { Profile } from "@/lib/types"
import { useLanguage } from "@/lib/i18n/language-context"
import { LanguageSwitcher } from "./language-switcher"
import { ThemeSwitcher } from "./theme-switcher"

interface MobileMenuProps {
  user: User | null
  profile: Profile | null
}

export function MobileMenu({ user, profile }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const { t } = useLanguage()
  const { count } = useUnreadMessageCount(user?.id)

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setIsOpen(false)
    router.refresh()
  }

  return (
    <div className="md:hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label={isOpen ? t("nav.close_menu") : t("nav.open_menu")}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-16 border-b border-border bg-background p-4 shadow-lg">
          <nav className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-xs font-medium text-muted-foreground uppercase">{t("nav.home")}</span>
              <div className="flex items-center gap-1">
                <LanguageSwitcher />
                <ThemeSwitcher />
              </div>
            </div>
            <Link
              href="/listings"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Wrench className="h-4 w-4" />
              {t("nav.explore")}
            </Link>
            <Link
              href="/categories"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Package className="h-4 w-4" />
              {t("nav.categories")}
            </Link>
            <Link
              href="/how-it-works"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Settings className="h-4 w-4" />
              {t("nav.how_it_works")}
            </Link>

            <div className="my-2 border-t border-border" />

            {user ? (
              <>
                <Link
                  href="/listings/new"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90"
                >
                  <Plus className="h-4 w-4" />
                  {t("nav.publish_listing")}
                </Link>
                <Link
                  href="/dashboard"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  <UserIcon className="h-4 w-4" />
                  {t("nav.dashboard")}
                </Link>
                <Link
                  href="/messages"
                  onClick={() => setIsOpen(false)}
                  className="relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  <MessageSquare className="h-4 w-4" />
                  {t("nav.messages")}
                  {count > 0 && (
                    <span className="absolute right-3 top-2 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-destructive px-1.5 text-[0.65rem] font-semibold text-destructive-foreground">
                      {count > 9 ? "9+" : count}
                    </span>
                  )}
                </Link>
                <Link
                  href="/bookings"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  <Package className="h-4 w-4" />
                  {t("nav.my_rentals")}
                </Link>
                <button
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
                >
                  <LogOut className="h-4 w-4" />
                  {t("nav.logout")}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-center rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  {t("nav.login")}
                </Link>
                <Link
                  href="/auth/sign-up"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-center rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  {t("nav.signup")}
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </div>
  )
}

