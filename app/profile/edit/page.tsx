import { requirePageUser } from "@/lib/auth/page"
import { getServerI18n } from "@/lib/i18n/server"
import { NotificationPreferencesForm } from "@/components/profile/notification-preferences-form"

export default async function ProfileEditPage() {
  const { t } = await getServerI18n()
  await requirePageUser("/profile/edit")

  return (
    <div className="min-h-screen bg-muted/30 py-8">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <h1 className="text-2xl font-bold text-foreground">{t("profile_edit.title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("profile_edit.subtitle")}</p>

        <div className="mt-8 rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">{t("notifications.prefs.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("notifications.prefs.subtitle")}</p>
          <div className="mt-6">
            <NotificationPreferencesForm />
          </div>
        </div>
      </div>
    </div>
  )
}
