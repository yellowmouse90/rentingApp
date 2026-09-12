import { requireApiUser } from "@/lib/auth/api"
import { NextResponse } from "next/server"

/**
 * @swagger
 * /chat/start-conversation:
 *   post:
 *     tags: [Chat]
 *     summary: Crea (o recupera) la conversazione per un ordine di noleggio
 *     description: >
 *       Una sola conversazione per rental_order_id. Verifica che chiamante e destinatario siano
 *       effettivamente le due controparti dell'ordine prima di creare la riga.
 *     security:
 *       - supabaseSessionCookie: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rentalOrderId, participantTwoId]
 *             properties:
 *               rentalOrderId: { type: string, format: uuid }
 *               participantTwoId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Conversazione già esistente, restituita
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 conversation: { $ref: '#/components/schemas/Conversation' }
 *       201:
 *         description: Conversazione creata
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 conversation: { $ref: '#/components/schemas/Conversation' }
 *       400:
 *         description: Campi mancanti o partecipanti non validi
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Non autenticato
 *       403:
 *         description: Il chiamante o il destinatario non sono le controparti di questo ordine
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Ordine non trovato
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       500:
 *         description: Errore interno
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
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

    // Check if conversation already exists for this rental order. Select every column here (not
    // just "id") - the caller parses this into the same Conversation model used everywhere else
    // (e.g. the Flutter app's Conversation.fromJson requires rental_order_id/created_at), and this
    // is now the common case since booking-form.tsx eagerly creates the conversation up front.
    const { data: existing } = await supabase
      .schema("interactions_domain")
      .from("conversations")
      .select()
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
