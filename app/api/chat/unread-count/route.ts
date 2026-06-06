import { requireApiUser } from "@/lib/auth/api"
import { NextResponse } from "next/server"

export async function GET() {
  const { supabase, user, unauthorizedResponse } = await requireApiUser()
  if (unauthorizedResponse) {
    return unauthorizedResponse
  }

  const { data: conversations, error: convError } = await supabase
    .schema("interactions_domain")
    .from("conversations")
    .select("id")
    .or(`participant_one.eq.${user.id},participant_two.eq.${user.id}`)

  if (convError) {
    console.error("Unread count conversation query error:", convError)
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 }
    )
  }

  const conversationIds = (conversations || []).map((conversation) => conversation.id)
  if (conversationIds.length === 0) {
    return NextResponse.json({ unread_count: 0 })
  }

  const { count, error: messagesError } = await supabase
    .schema("interactions_domain")
    .from("messages")
    .select("id", { count: "exact", head: true })
    .in("conversation_id", conversationIds)
    .eq("is_read", false)
    .neq("sender_id", user.id)

  if (messagesError) {
    console.error("Unread count messages query error:", messagesError)
    return NextResponse.json(
      { error: "Failed to fetch unread count" },
      { status: 500 }
    )
  }

  return NextResponse.json({ unread_count: count ?? 0 })
}
