import { NextResponse } from "next/server"
import { requireApiUser } from "@/lib/auth/api"

export async function GET() {
  const { supabase, user, unauthorizedResponse } = await requireApiUser()
  if (unauthorizedResponse) {
    return unauthorizedResponse
  }

  const { count, error } = await supabase
    .schema("notifications_domain")
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", user!.id)
    .eq("is_read", false)

  if (error) {
    console.error("Notifications unread count error:", error)
    return NextResponse.json({ error: "Impossibile recuperare il conteggio" }, { status: 500 })
  }

  return NextResponse.json({ unread_count: count ?? 0 })
}
