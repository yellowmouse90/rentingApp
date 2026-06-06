import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("user_id")

    if (!userId) {
      return NextResponse.json(
        { error: "user_id is required" },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get all conversations for the user
    const { data: conversations, error } = await supabase
      .schema("interactions_domain")
      .from("conversations")
      .select(
        `
        *,
        messages(id, content, sender_id, created_at, is_read)
      `
      )
      .or(`participant_one.eq.${userId},participant_two.eq.${userId}`)
      .order("last_message_at", { ascending: false })

    if (error) {
      console.error("Conversations fetch error:", error)
      return NextResponse.json(
        { error: "Failed to fetch conversations" },
        { status: 500 }
      )
    }

    const participantIds = new Set<string>()
    const rentalOrderIds = new Set<string>()

    const conversationsList = (conversations || []).map((conversation: any) => {
      const otherParticipantId =
        conversation.participant_one === userId
          ? conversation.participant_two
          : conversation.participant_one

      if (otherParticipantId) {
        participantIds.add(otherParticipantId)
      }

      if (conversation.rental_order_id) {
        rentalOrderIds.add(conversation.rental_order_id)
      }

      return conversation
    })

    const [{ data: profiles, error: profilesError }, { data: orders, error: ordersError }, { data: items, error: itemsError }] =
      await Promise.all([
        participantIds.size
          ? supabase
              .schema("users_domain")
              .from("profiles")
              .select("id, display_name, avatar_url, email")
              .in("id", [...participantIds])
          : Promise.resolve({ data: [], error: null }),
        rentalOrderIds.size
          ? supabase
              .schema("rentals_domain")
              .from("rental_orders")
              .select(
                "id, renter_id, status, subtotal_cents, service_fee_cents, total_deposit_cents, grand_total_cents, currency_code, notes, created_at, updated_at"
              )
              .in("id", [...rentalOrderIds])
          : Promise.resolve({ data: [], error: null }),
        rentalOrderIds.size
          ? supabase
              .schema("rentals_domain")
              .from("rental_items")
              .select(
                "id, order_id, listing_id, owner_id, start_date, end_date, daily_rate_cents, total_days, item_subtotal_cents, deposit_cents, status"
              )
              .in("order_id", [...rentalOrderIds])
          : Promise.resolve({ data: [], error: null }),
      ])

    if (profilesError || ordersError || itemsError) {
      console.error("Conversations enrichment error:", profilesError || ordersError || itemsError)
      return NextResponse.json(
        { error: "Failed to enrich conversations" },
        { status: 500 }
      )
    }

    const profileById = new Map((profiles || []).map((profile: any) => [profile.id, profile]))
    const orderItemsByOrderId = new Map<string, any[]>()
    ;(items || []).forEach((item: any) => {
      const orderItems = orderItemsByOrderId.get(item.order_id) || []
      orderItems.push(item)
      orderItemsByOrderId.set(item.order_id, orderItems)
    })

    const orderById = new Map((orders || []).map((order: any) => [order.id, order]))

    const conversationsWithUnread = conversationsList.map((conversation: any) => {
      const unread_count = (conversation.messages || []).filter(
        (message: any) =>
          !message.is_read && message.sender_id !== userId
      ).length

      const otherParticipantId =
        conversation.participant_one === userId
          ? conversation.participant_two
          : conversation.participant_one

      const order = orderById.get(conversation.rental_order_id)
      const rental_order = order
        ? {
            ...order,
            items: orderItemsByOrderId.get(order.id) || [],
          }
        : null

      return {
        ...conversation,
        other_participant_details: profileById.get(otherParticipantId) || null,
        rental_order,
        unread_count,
      }
    })

    return NextResponse.json({ conversations: conversationsWithUnread })
  } catch (error) {
    console.error("Conversations API error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
