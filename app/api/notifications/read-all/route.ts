import { NextResponse } from "next/server"
import { requireApiUser } from "@/lib/auth/api"

export async function POST() {
  const { supabase, user, unauthorizedResponse } = await requireApiUser()
  if (unauthorizedResponse) {
    return unauthorizedResponse
  }

  const { error } = await supabase
    .schema("notifications_domain")
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("recipient_id", user!.id)
    .eq("is_read", false)

  if (error) {
    console.error("Notifications read-all error:", error)
    return NextResponse.json({ error: "Impossibile aggiornare le notifiche" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
