import { NextRequest, NextResponse } from "next/server"
import { requireApiUser } from "@/lib/auth/api"
import { createNotification } from "@/lib/notifications/create"
import { getServerLanguage } from "@/lib/i18n/server"
import {
  deriveReviewContext,
  isWithinReviewWindow,
  validateReviewInput,
  type ReviewInput,
} from "@/lib/reviews/rules"
import type { ReviewTargetRole } from "@/lib/types"

interface ReviewPayload extends ReviewInput {
  target_role: ReviewTargetRole
}

interface PageParams {
  params: Promise<{ id: string }>
}

// Everything beyond overall_rating/sub_ratings/comment/tags is derived
// server-side from the booking itself, never trusted from the request body
// (spec sez. 5: "deriva context e target_user_id dalla booking, non
// fidarsi del client"). The same checks are re-enforced at the DB level by
// reviews_domain.can_submit_review (see migration 012) - that function is
// the actual authorization boundary since PostgREST is reachable directly
// with the caller's own session, this route only exists to give specific,
// friendly error messages before that boundary is hit.
/**
 * @swagger
 * /bookings/{id}/reviews:
 *   post:
 *     tags: [Reviews]
 *     summary: Crea una recensione per una prenotazione conclusa
 *     description: >
 *       context e target_user_id sono derivati server-side dalla booking, mai fidati dal body.
 *       Riapplicato a livello DB da reviews_domain.can_submit_review, il vero confine di
 *       autorizzazione (PostgREST è raggiungibile direttamente con la sessione del chiamante).
 *     security:
 *       - supabaseSessionCookie: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: rental_orders.id (booking_id)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ReviewInput' }
 *     responses:
 *       200:
 *         description: Recensione creata
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean }
 *                 id: { type: string, format: uuid }
 *                 visible: { type: boolean }
 *       400:
 *         description: Payload non valido, prenotazione non completata, o finestra 14gg scaduta
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Non autenticato
 *       403:
 *         description: Il chiamante non ha il ruolo giusto per recensire questo target_role
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Prenotazione, dettaglio o profilo del prestatore non trovato
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       409:
 *         description: Recensione già presente per questa prenotazione/ruolo
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       500:
 *         description: Errore interno
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
export async function POST(request: NextRequest, { params }: PageParams) {
  try {
    const { id: bookingId } = await params
    const { supabase, user, unauthorizedResponse } = await requireApiUser()
    if (!user) return unauthorizedResponse as NextResponse

    const payload = (await request.json()) as ReviewPayload

    if (payload?.target_role !== "lender" && payload?.target_role !== "renter") {
      return NextResponse.json({ error: "target_role mancante o non valido" }, { status: 400 })
    }

    const inputErrors = validateReviewInput(payload)
    if (inputErrors.length > 0) {
      return NextResponse.json({ error: inputErrors.join("; ") }, { status: 400 })
    }

    const { data: order, error: orderError } = await supabase
      .schema("rentals_domain")
      .from("rental_orders")
      .select("id, renter_id, status, updated_at")
      .eq("id", bookingId)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: "Prenotazione non trovata" }, { status: 404 })
    }

    const { data: item, error: itemError } = await supabase
      .schema("rentals_domain")
      .from("rental_items")
      .select("id, owner_id")
      .eq("order_id", bookingId)
      .single()

    if (itemError || !item) {
      return NextResponse.json({ error: "Dettaglio noleggio non trovato" }, { status: 404 })
    }

    if (order.status !== "completed") {
      return NextResponse.json(
        { error: "La recensione si può lasciare solo dopo che il noleggio è concluso" },
        { status: 400 }
      )
    }

    if (!isWithinReviewWindow(order.updated_at)) {
      return NextResponse.json(
        { error: "La finestra di 14 giorni per lasciare una recensione è scaduta" },
        { status: 400 }
      )
    }

    const isOwner = item.owner_id === user.id
    const isRenter = order.renter_id === user.id

    let targetUserId: string
    if (payload.target_role === "lender") {
      if (!isRenter) {
        return NextResponse.json(
          { error: "Solo chi ha noleggiato può recensire il prestatore" },
          { status: 403 }
        )
      }
      targetUserId = item.owner_id
    } else {
      if (!isOwner) {
        return NextResponse.json(
          { error: "Solo il prestatore può recensire il noleggiatore" },
          { status: 403 }
        )
      }
      targetUserId = order.renter_id
    }

    const { data: lenderProfile, error: lenderProfileError } = await supabase
      .schema("users_domain")
      .from("profiles")
      .select("account_type")
      .eq("id", item.owner_id)
      .single()

    if (lenderProfileError || !lenderProfile) {
      return NextResponse.json({ error: "Profilo del prestatore non trovato" }, { status: 404 })
    }

    const context = deriveReviewContext(lenderProfile.account_type as "individual" | "business")

    const { data: review, error: insertError } = await supabase
      .schema("reviews_domain")
      .from("reviews")
      .insert({
        booking_id: bookingId,
        author_user_id: user.id,
        target_user_id: targetUserId,
        target_role: payload.target_role,
        context,
        overall_rating: payload.overall_rating,
        sub_ratings: payload.sub_ratings ?? {},
        comment: payload.comment?.trim() || null,
        tags: payload.tags ?? [],
      })
      .select("id, visible")
      .single()

    if (insertError || !review) {
      if (insertError?.code === "23505") {
        return NextResponse.json(
          { error: "Hai già lasciato una recensione per questa prenotazione in questo ruolo" },
          { status: 409 }
        )
      }
      console.error("Reviews: inserimento fallito", insertError)
      return NextResponse.json({ error: "Impossibile salvare la recensione" }, { status: 500 })
    }

    if (review.visible) {
      const language = await getServerLanguage()
      await createNotification({
        recipientId: targetUserId,
        actorId: user.id,
        type: "review_received",
        language,
        orderId: bookingId,
      })
    }

    return NextResponse.json({ ok: true, id: review.id, visible: review.visible })
  } catch (error) {
    console.error("Reviews API error:", error)
    return NextResponse.json({ error: "Errore durante la creazione della recensione" }, { status: 500 })
  }
}
