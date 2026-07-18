import { requireApiUser } from "@/lib/auth/api"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { supabase, user, unauthorizedResponse } = await requireApiUser()
    if (unauthorizedResponse) {
      return unauthorizedResponse
    }

    const { rentalOrderId, participantTwoId } = await request.json()

    if (!rentalOrderId || !participantTwoId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    const participantOneId = user!.id

    if (participantTwoId === participantOneId) {
      return NextResponse.json(
        { error: "Invalid participants" },
        { status: 400 }
      )
    }

    // Verify the authenticated user and the other participant are actually
    // tied to this rental order (renter on one side, item owner on the other)
    const { data: order, error: orderError } = await supabase
      .schema("rentals_domain")
      .from("rental_orders")
      .select("id, renter_id")
      .eq("id", rentalOrderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        { error: "Rental order not found" },
        { status: 404 }
      )
    }

    const { data: items, error: itemsError } = await supabase
      .schema("rentals_domain")
      .from("rental_items")
      .select("owner_id")
      .eq("order_id", rentalOrderId)

    if (itemsError) {
      return NextResponse.json(
        { error: "Failed to verify rental order" },
        { status: 500 }
      )
    }

    const ownerIds = new Set((items || []).map((item: any) => item.owner_id))
    const isRenter = order.renter_id === participantOneId
    const isOwner = ownerIds.has(participantOneId)

    if (!isRenter && !isOwner) {
      return NextResponse.json(
        { error: "Non sei autorizzato ad avviare una conversazione per questo ordine" },
        { status: 403 }
      )
    }

    const otherIsValidCounterpart = isRenter
      ? ownerIds.has(participantTwoId)
      : participantTwoId === order.renter_id

    if (!otherIsValidCounterpart) {
      return NextResponse.json(
        { error: "Destinatario non valido per questo ordine" },
        { status: 403 }
      )
    }

    // Check if conversation already exists for this rental order
    const { data: existing } = await supabase
      .schema("interactions_domain")
      .from("conversations")
      .select("id")
      .eq("rental_order_id", rentalOrderId)
      .single()

    if (existing) {
      return NextResponse.json({ conversation: existing })
    }

    // Create new conversation
    const { data: conversation, error } = await supabase
      .schema("interactions_domain")
      .from("conversations")
      .insert({
        rental_order_id: rentalOrderId,
        participant_one: participantOneId,
        participant_two: participantTwoId,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ conversation }, { status: 201 })
  } catch (error) {
    console.error("Conversation creation error:", error)
    return NextResponse.json(
      { error: "Failed to create conversation" },
      { status: 500 }
    )
  }
}
