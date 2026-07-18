import { createClient } from "@/lib/supabase/server"
import { requireApiUser } from "@/lib/auth/api"
import {
  MAX_MESSAGE_LENGTH,
  MESSAGE_RATE_LIMIT_MAX,
  MESSAGE_RATE_LIMIT_WINDOW_MS,
} from "@/lib/types/chat"
import { NextResponse } from "next/server"

const DEFAULT_PAGE_SIZE = 50
const MAX_PAGE_SIZE = 100

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get("conversation_id")
    const before = searchParams.get("before")
    const limitParam = parseInt(searchParams.get("limit") || "", 10)
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE

    if (!conversationId) {
      return NextResponse.json(
        { error: "conversation_id is required" },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Fetch the most recent page of messages (or the page right before
    // `before`), newest first, then reverse for chronological display.
    let query = supabase
      .schema("interactions_domain")
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(limit + 1)

    if (before) {
      query = query.lt("created_at", before)
    }

    const { data: messages, error } = await query

    if (error) {
      console.error("Messages fetch error:", error)
      return NextResponse.json(
        { error: "Failed to fetch messages" },
        { status: 500 }
      )
    }

    const rows = messages || []
    const hasMore = rows.length > limit
    const page = rows.slice(0, limit).reverse()

    return NextResponse.json({ messages: page, hasMore })
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
    const { supabase, user, unauthorizedResponse } = await requireApiUser()
    if (unauthorizedResponse) {
      return unauthorizedResponse
    }

    const { conversationId, content } = await request.json()

    if (!conversationId || typeof content !== "string" || !content.trim()) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    const trimmedContent = content.trim()

    if (trimmedContent.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `Il messaggio supera il limite di ${MAX_MESSAGE_LENGTH} caratteri` },
        { status: 400 }
      )
    }

    const rateWindowStart = new Date(
      Date.now() - MESSAGE_RATE_LIMIT_WINDOW_MS
    ).toISOString()
    const { count: recentMessageCount, error: rateLimitError } = await supabase
      .schema("interactions_domain")
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("sender_id", user!.id)
      .gte("created_at", rateWindowStart)

    if (rateLimitError) {
      console.error("Rate limit check error:", rateLimitError)
    } else if ((recentMessageCount ?? 0) >= MESSAGE_RATE_LIMIT_MAX) {
      return NextResponse.json(
        { error: "Troppi messaggi inviati, riprova tra poco" },
        { status: 429 }
      )
    }

    // Create the message (sender is always the authenticated user)
    const { data: message, error: messageError } = await supabase
      .schema("interactions_domain")
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: user!.id,
        content: trimmedContent,
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
