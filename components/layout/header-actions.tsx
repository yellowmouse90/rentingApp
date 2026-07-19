"use client"

import Link from "next/link"
import { Plus } from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"
import { LanguageSwitcher } from "./language-switcher"
import { ThemeSwitcher } from "./theme-switcher"
import { UserMenu } from "./user-menu"
import { ChatNotification } from "@/components/chat/chat-notification"
import { NotificationBell } from "@/components/notifications/notification-bell"
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
        <ThemeSwitcher />
        <Link
          href="/listings/new"
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90"
        >
          <Plus className="h-4 w-4" />
          {t("nav.publish_listing")}
        </Link>
        <ChatNotification userId={user.id} />
        <NotificationBell userId={user.id} />
        <UserMenu user={user} profile={profile} />
      </>
    )
  }

  return (
    <>
      <LanguageSwitcher />
      <ThemeSwitcher />
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

