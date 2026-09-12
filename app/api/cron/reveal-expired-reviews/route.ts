import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createNotification } from "@/lib/notifications/create"
import { REVIEW_WINDOW_DAYS } from "@/lib/reviews/rules"

// Spec sez. 4, third bullet: "Se solo una parte scrive la recensione e
// passano 14 giorni dalla chiusura booking -> rendere visibile comunque
// quella scritta". Runs daily (see vercel.json) with no request-scoped
// session, and flips visibility on rows authored by other users - exactly
// the cross-user-write-with-no-session case CLAUDE.md calls out as the
// legitimate use of the admin client (same as notification creation).
//
// The double-blind reveal-on-match path (both sides written) is handled
// synchronously by the reviews_domain.apply_visibility_rules DB trigger at
// insert time - this job only ever deals with a review that is still
// alone after its booking's 14-day window has lapsed.
/**
 * @swagger
 * /cron/reveal-expired-reviews:
 *   get:
 *     tags: [Cron]
 *     summary: Rende visibili le recensioni p2p rimaste sole oltre la finestra di 14 giorni
 *     description: >
 *       Job Vercel Cron giornaliero. Il reveal "double-blind" immediato quando esistono entrambe
 *       le recensioni è gestito dal trigger DB reviews_domain.apply_visibility_rules; questo job
 *       copre solo il caso di una recensione ancora sola dopo 14 giorni dalla chiusura booking.
 *     security:
 *       - cronSecret: []
 *     responses:
 *       200:
 *         description: Numero di recensioni rese visibili
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 revealed: { type: integer }
 *       401:
 *         description: CRON_SECRET mancante/non corrispondente
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       500:
 *         description: Errore interno
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
export async function GET(request: NextRequest) {
  // Fail closed: if CRON_SECRET is missing (misconfigured env, exactly the kind of gap CI's
  // placeholder-env build doesn't catch - see CLAUDE.md), this must reject every request rather
  // than run unauthenticated with the admin client.
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get("authorization")
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const cutoffMs = Date.now() - REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000

    const { data: pending, error: pendingError } = await supabase
      .schema("reviews_domain")
      .from("reviews")
      .select("id, booking_id, target_user_id")
      .eq("context", "p2p")
      .eq("visible", false)
      .limit(500)

    if (pendingError) {
      console.error("Cron reveal-expired-reviews: lettura recensioni pendenti fallita", pendingError)
      return NextResponse.json({ error: "Lettura recensioni pendenti fallita" }, { status: 500 })
    }

    if (!pending || pending.length === 0) {
      return NextResponse.json({ revealed: 0 })
    }

    const bookingIds = [...new Set(pending.map((r) => r.booking_id))]
    const { data: orders, error: ordersError } = await supabase
      .schema("rentals_domain")
      .from("rental_orders")
      .select("id, status, updated_at")
      .in("id", bookingIds)

    if (ordersError) {
      console.error("Cron reveal-expired-reviews: lettura prenotazioni fallita", ordersError)
      return NextResponse.json({ error: "Lettura prenotazioni fallita" }, { status: 500 })
    }

    const expiredBookingIds = new Set(
      (orders || [])
        .filter((o) => o.status === "completed" && new Date(o.updated_at).getTime() <= cutoffMs)
        .map((o) => o.id)
    )

    const toReveal = pending.filter((r) => expiredBookingIds.has(r.booking_id))
    let revealed = 0

    for (const review of toReveal) {
      const now = new Date().toISOString()
      const { error: updateError } = await supabase
        .schema("reviews_domain")
        .from("reviews")
        .update({ visible: true, visible_at: now, updated_at: now })
        .eq("id", review.id)
        .eq("visible", false)

      if (updateError) {
        console.error("Cron reveal-expired-reviews: aggiornamento fallito", review.id, updateError)
        continue
      }

      revealed += 1
      await createNotification({
        recipientId: review.target_user_id,
        actorId: null,
        type: "review_received",
        orderId: review.booking_id,
      })
    }

    return NextResponse.json({ revealed })
  } catch (error) {
    console.error("Cron reveal-expired-reviews error:", error)
    return NextResponse.json({ error: "Errore durante lo sblocco delle recensioni scadute" }, { status: 500 })
  }
}
