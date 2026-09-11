import { NextRequest, NextResponse } from "next/server"
import { requireApiUser } from "@/lib/auth/api"
import { createNotification } from "@/lib/notifications/create"

interface PageParams {
  params: Promise<{ id: string }>
}

// booking-form.tsx creates rental_orders/rental_items itself, directly from the client (using
// the renter's own RLS-gated session) - there is no server-side code path at all for a brand new
// booking request, unlike every later transition (app/api/bookings/[id]/transition/route.ts),
// which is why the owner never got notified (in-app or by email) that a request came in: nothing
// ever called createNotification() for it. This route is that missing entry point - the client
// calls it right after its own insert succeeds (see booking-form.tsx).
/**
 * @swagger
 * /bookings/{id}/notify-request:
 *   post:
 *     tags: [Bookings]
 *     summary: Notifica al proprietario che una nuova richiesta di noleggio è stata creata
 *     description: >
 *       Chiamata dal client subito dopo che l'inserimento di rental_orders/rental_items (fatto
 *       direttamente dal client con la propria sessione RLS) va a buon fine - non è una
 *       transizione di stato, solo il trigger della notifica "nuova richiesta".
 *     security:
 *       - supabaseSessionCookie: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Notifica inviata
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Ok' }
 *       401:
 *         description: Non autenticato
 *       403:
 *         description: Il chiamante non è il renter di questo ordine
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Ordine o dettaglio non trovato
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       500:
 *         description: Errore interno
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
export async function POST(_request: NextRequest, { params }: PageParams) {
  try {
    const { id: orderId } = await params
    const { supabase, user, unauthorizedResponse } = await requireApiUser()

    if (!user) {
      return unauthorizedResponse as NextResponse
    }

    const { data: order, error: orderError } = await supabase
      .schema("rentals_domain")
      .from("rental_orders")
      .select("id, renter_id, status")
      .eq("id", orderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: "Ordine non trovato" }, { status: 404 })
    }

    // Only the renter who just created this request can trigger its own "new request"
    // notification - this isn't a state transition (the order is already "pending"), just the
    // one-time signal to the owner that it exists.
    if (order.renter_id !== user.id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 403 })
    }

    const { data: item, error: itemError } = await supabase
      .schema("rentals_domain")
      .from("rental_items")
      .select("owner_id")
      .eq("order_id", orderId)
      .single()

    if (itemError || !item) {
      return NextResponse.json({ error: "Dettaglio noleggio non trovato" }, { status: 404 })
    }

    await createNotification({
      recipientId: item.owner_id,
      actorId: user.id,
      type: "booking_requested",
      orderId,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Booking notify-request error:", error)
    return NextResponse.json({ error: "Errore durante l'invio della notifica" }, { status: 500 })
  }
}
