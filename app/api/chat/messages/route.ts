import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get("conversation_id")

    if (!conversationId) {
      return NextResponse.json(
        { error: "conversation_id is required" },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get all messages for a conversation
    const { data: messages, error } = await supabase
      .schema("interactions_domain")
      .from("messages")
      .select(
        `
        *
      `
      )
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })

    if (error) {
      console.error("Messages fetch error:", error)
      return NextResponse.json(
        { error: "Failed to fetch messages" },
        { status: 500 }
      )
    }

    return NextResponse.json({ messages })
  } catch (error) {
    console.error("Messages API error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const { conversationId, content, senderId } = await request.json()

    if (!conversationId || !content || !senderId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Create the message
    const { data: message, error: messageError } = await supabase
      .schema("interactions_domain")
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        content,
        is_read: false,
      })
      .select()
      .single()

    if (messageError) throw messageError

    // Update conversation's last_message_at
    const { error: updateError } = await supabase
      .schema("interactions_domain")
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversationId)

    if (updateError) throw updateError

    return NextResponse.json({ message }, { status: 201 })
  } catch (error) {
    console.error("Message creation error:", error)
    return NextResponse.json(
      { error: "Failed to create message" },
      { status: 500 }
    )
  }
}
