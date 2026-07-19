import { NextRequest, NextResponse } from "next/server"
import { requireApiUser } from "@/lib/auth/api"

interface PageParams {
  params: Promise<{ id: string }>
}

export async function POST(_request: NextRequest, { params }: PageParams) {
  const { id } = await params
  const { supabase, user, unauthorizedResponse } = await requireApiUser()
  if (unauthorizedResponse) {
    return unauthorizedResponse
  }

  // `.update()` without `.select()` never surfaces an RLS-blocked 0-row
  // write as an error - chain `.select().single()` so a notification that
  // isn't this user's (or doesn't exist) fails loudly instead of silently.
  const { data, error } = await supabase
    .schema("notifications_domain")
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("recipient_id", user!.id)
    .select("id")
    .single()

  if (error || !data) {
    return NextResponse.json({ error: "Notifica non trovata" }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
