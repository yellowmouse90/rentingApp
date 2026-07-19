import { NextResponse } from "next/server"
import { requireApiUser } from "@/lib/auth/api"
import { getEffectivePreferences } from "@/lib/notifications/preferences"
import { ALERT_TYPES, type AlertType } from "@/lib/notifications/types"

export async function GET() {
  const { supabase, user, unauthorizedResponse } = await requireApiUser()
  if (unauthorizedResponse) {
    return unauthorizedResponse
  }

  const preferences = await getEffectivePreferences(supabase, user!.id)

  return NextResponse.json({ preferences })
}

interface PreferencesPayload {
  alertType: AlertType
  inApp: boolean
  email: boolean
}

export async function PUT(request: Request) {
  const { supabase, user, unauthorizedResponse } = await requireApiUser()
  if (unauthorizedResponse) {
    return unauthorizedResponse
  }

  const payload = (await request.json().catch(() => null)) as PreferencesPayload | null

  if (!payload || !ALERT_TYPES.includes(payload.alertType)) {
    return NextResponse.json({ error: "Tipo di alert non valido" }, { status: 400 })
  }

  const { error } = await supabase
    .schema("notifications_domain")
    .from("notification_preferences")
    .upsert(
      {
        user_id: user!.id,
        alert_type: payload.alertType,
        in_app_enabled: Boolean(payload.inApp),
        email_enabled: Boolean(payload.email),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,alert_type" }
    )

  if (error) {
    console.error("Notification preference update error:", error)
    return NextResponse.json({ error: "Impossibile salvare la preferenza" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
