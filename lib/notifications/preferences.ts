import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { ALERT_TYPES, DEFAULT_PREFERENCES, type AlertType, type NotificationPreference } from "./types"

export async function getEffectivePreference(
  supabase: SupabaseClient,
  userId: string,
  alertType: AlertType
): Promise<NotificationPreference> {
  const { data } = await supabase
    .schema("notifications_domain")
    .from("notification_preferences")
    .select("in_app_enabled, email_enabled")
    .eq("user_id", userId)
    .eq("alert_type", alertType)
    .maybeSingle()

  if (!data) return DEFAULT_PREFERENCES[alertType]

  return { inApp: data.in_app_enabled, email: data.email_enabled }
}

export async function getEffectivePreferences(
  supabase: SupabaseClient,
  userId: string
): Promise<Record<AlertType, NotificationPreference>> {
  const { data } = await supabase
    .schema("notifications_domain")
    .from("notification_preferences")
    .select("alert_type, in_app_enabled, email_enabled")
    .eq("user_id", userId)

  const stored = new Map((data || []).map((row) => [row.alert_type as AlertType, row]))

  const result = {} as Record<AlertType, NotificationPreference>
  for (const type of ALERT_TYPES) {
    const row = stored.get(type)
    result[type] = row ? { inApp: row.in_app_enabled, email: row.email_enabled } : DEFAULT_PREFERENCES[type]
  }
  return result
}
