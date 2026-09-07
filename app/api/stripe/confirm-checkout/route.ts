import { NextRequest, NextResponse } from "next/server"
import { requireApiUser } from "@/lib/auth/api"
import { stripe, upsertAuthorizedTransaction } from "@/lib/stripe"

/**
 * @swagger
 * /stripe/confirm-checkout:
 *   post:
 *     tags: [Stripe]
 *     summary: Conferma lato server il completamento di una sessione Checkout
 *     description: >
 *       session.payment_status resta "unpaid" con capture_method manual: il successo si rileva
 *       da session.status === "complete" e paymentIntent.status in (requires_capture, succeeded).
 *       Scrive tramite upsertAuthorizedTransaction (client admin) perché la sessione del renter
 *       non ha UPDATE su rental_items.
 *     security:
 *       - supabaseSessionCookie: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderId, sessionId]
 *             properties:
 *               orderId: { type: string, format: uuid }
 *               sessionId: { type: string }
 *     responses:
 *       200:
 *         description: Transazione confermata/registrata
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Ok' }
 *       400:
 *         description: Parametri mancanti, sessione non valida o pagamento non completato
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Non autenticato
 *       403:
 *         description: Il chiamante non è il renter dell'ordine
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Ordine non trovato
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       409:
 *         description: Ordine annullato, pagamento a sua volta annullato
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       500:
 *         description: Errore interno
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
export async function POST(request: NextRequest) {
  try {
    const { supabase, user, unauthorizedResponse } = await requireApiUser()

    if (!user) {
      return unauthorizedResponse as NextResponse
    }

    const { orderId, sessionId } = await request.json()

    if (!orderId || !sessionId) {
      return NextResponse.json({ error: "Parametri mancanti" }, { status: 400 })
    }

    const { data: order, error: orderError } = await supabase
      .schema("rentals_domain")
      .from("rental_orders")
      .select("id, renter_id")
      .eq("id", orderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: "Ordine non trovato" }, { status: 404 })
    }

    if (order.renter_id !== user.id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 403 })
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent"],
    })

    if (session.metadata?.orderId !== orderId || session.metadata?.userId !== user.id) {
      return NextResponse.json({ error: "Sessione non valida" }, { status: 400 })
    }

    const paymentIntent = session.payment_intent

    if (!paymentIntent || typeof paymentIntent === "string") {
      return NextResponse.json({ error: "Payment intent non trovato" }, { status: 400 })
    }

    // For capture_method: "manual", session.payment_status stays "unpaid" even after a
    // successful authorization - Stripe only marks it "paid" once funds are captured, which
    // here only happens later at handover. The real success signal is the PaymentIntent
    // reaching "requires_capture" (authorized) or "succeeded" (already captured).
    if (paymentIntent.status !== "requires_capture" && paymentIntent.status !== "succeeded") {
      return NextResponse.json({ error: "Pagamento non completato" }, { status: 400 })
    }

    // Authorization for this confirmation is already established above (renter_id match plus
    // the Stripe session's own metadata/user match), so the actual write goes through the
    // admin-client-backed helper shared with the webhook - the renter's own session has no
    // UPDATE policy on rental_items (only the owner does), so doing this write with the
    // user-scoped client used to silently fail to move the order past "accepted".
    const result = await upsertAuthorizedTransaction(orderId, paymentIntent.id)

    if (result === "order_not_found") {
      return NextResponse.json({ error: "Ordine non trovato" }, { status: 404 })
    }

    if (result === "cancelled") {
      return NextResponse.json(
        { error: "Questo ordine è stato annullato: il pagamento è stato annullato e non è stato addebitato alcun importo." },
        { status: 409 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Stripe confirm checkout error:", error)
    return NextResponse.json({ error: "Errore durante la conferma del pagamento" }, { status: 500 })
  }
}

