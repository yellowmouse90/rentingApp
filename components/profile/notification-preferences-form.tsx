"use client"

import { useEffect, useState } from "react"
import { useLanguage } from "@/lib/i18n/language-context"
import { DEFAULT_PREFERENCES, type AlertType, type NotificationPreference } from "@/lib/notifications/types"

type PreferencesMap = Record<AlertType, NotificationPreference>

const BOOKING_TYPES: AlertType[] = [
  "booking_accepted",
  "booking_rejected",
  "booking_cancelled_by_renter",
  "booking_handover_confirmed",
  "booking_returned_ok",
  "booking_damage_reported",
]

const PAYMENT_TYPES: AlertType[] = ["payment_succeeded", "payment_failed", "stripe_onboarding_complete"]

interface ChannelSelectorProps {
  preference: NotificationPreference
  onChange: (next: NotificationPreference) => void
}

// "Niente" is a shortcut for {inApp: false, email: false}, not a third
// independent flag - the underlying state is still just the two booleans,
// this is only a friendlier way to present/toggle them than two separate
// switches.
function ChannelSelector({ preference, onChange }: ChannelSelectorProps) {
  const { t } = useLanguage()
  const isNone = !preference.inApp && !preference.email

  const optionClass = (active: boolean) =>
    `px-3 py-1.5 text-xs font-medium transition-colors ${
      active ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground hover:bg-muted"
    }`

  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-border">
      <button type="button" onClick={() => onChange({ inApp: false, email: false })} className={optionClass(isNone)}>
        {t("notifications.prefs.channel_none")}
      </button>
      <button
        type="button"
        onClick={() => onChange({ ...preference, inApp: !preference.inApp })}
        className={`border-l border-border ${optionClass(preference.inApp)}`}
      >
        {t("notifications.prefs.channel_in_app")}
      </button>
      <button
        type="button"
        onClick={() => onChange({ ...preference, email: !preference.email })}
        className={`border-l border-border ${optionClass(preference.email)}`}
      >
        {t("notifications.prefs.channel_email")}
      </button>
    </div>
  )
}

export function NotificationPreferencesForm() {
  const { t } = useLanguage()
  const [preferences, setPreferences] = useState<PreferencesMap>(DEFAULT_PREFERENCES)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const response = await fetch("/api/notifications/preferences")
        if (!response.ok) throw new Error("Failed to load preferences")
        const data = await response.json()
        if (!cancelled) setPreferences(data.preferences)
      } catch (err) {
        console.error("Notification preferences fetch error:", err)
        if (!cancelled) setError(t("notifications.prefs.load_error"))
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [t])

  const updatePreference = async (alertType: AlertType, next: NotificationPreference) => {
    const previous = preferences
    setPreferences((prev) => ({ ...prev, [alertType]: next }))

    try {
      const response = await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertType, inApp: next.inApp, email: next.email }),
      })
      if (!response.ok) throw new Error("Failed to save preference")
    } catch (err) {
      console.error("Notification preference save error:", err)
      setPreferences(previous)
      setError(t("notifications.prefs.save_error"))
    }
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
  }

  const renderGroup = (title: string, types: AlertType[]) => (
    <div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="mt-3 space-y-3">
        {types.map((type) => (
          <div key={type} className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-foreground">{t(`notifications.types.${type}`)}</span>
            <ChannelSelector
              preference={preferences[type]}
              onChange={(next) => updatePreference(type, next)}
            />
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="space-y-8">
      {error && <p className="text-sm text-destructive">{error}</p>}
      {renderGroup(t("notifications.prefs.section_bookings"), BOOKING_TYPES)}
      {renderGroup(t("notifications.prefs.section_payments"), PAYMENT_TYPES)}
    </div>
  )
}
