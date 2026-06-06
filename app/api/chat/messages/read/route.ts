import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { conversationId, messageIds } = await request.json()

    if (!conversationId || !messageIds || messageIds.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Mark messages as read
    const { error } = await supabase
      .schema("interactions_domain")
      .from("messages")
      .update({ is_read: true })
      .in("id", messageIds)
      .eq("conversation_id", conversationId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Mark as read error:", error)
    return NextResponse.json(
      { error: "Failed to mark messages as read" },
      { status: 500 }
    )
  }
}
