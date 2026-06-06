import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { rentalOrderId, participantOneId, participantTwoId } =
      await request.json()

    if (!rentalOrderId || !participantOneId || !participantTwoId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    const supabase = await createClient()

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
