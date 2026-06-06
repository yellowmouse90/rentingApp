"use client"

import Link from "next/link"
import { Plus, MessageSquare } from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"
import { LanguageSwitcher } from "./language-switcher"
import { UserMenu } from "./user-menu"
import type { User } from "@supabase/supabase-js"
import type { Profile } from "@/lib/types"

interface HeaderActionsProps {
  user: User | null
  profile: Profile | null
}

export function HeaderActions({ user, profile }: HeaderActionsProps) {
  const { t } = useLanguage()

  if (user) {
    return (
      <>
        <LanguageSwitcher />
        <Link
          href="/listings/new"
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90"
        >
          <Plus className="h-4 w-4" />
          {t("nav.publish_listing")}
        </Link>
        <Link
          href="/messages"
          className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <MessageSquare className="h-5 w-5" />
        </Link>
        <UserMenu user={user} profile={profile} />
      </>
    )
  }

  return (
    <>
      <LanguageSwitcher />
      <Link
        href="/auth/login"
        className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        {t("nav.login")}
      </Link>
      <Link
        href="/auth/sign-up"
        className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        {t("nav.signup")}
      </Link>
    </>
  )
}

