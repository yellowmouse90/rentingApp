import { NextRequest, NextResponse } from "next/server"
import { requireApiUser } from "@/lib/auth/api"
import { stripe } from "@/lib/stripe"

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
      .from("rental_orders")
      .select("id, renter_id, status, grand_total_cents, currency_code")
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

    if (session.payment_status !== "paid") {
      return NextResponse.json({ error: "Pagamento non completato" }, { status: 400 })
    }

    const paymentIntentId = paymentIntent.id

    const { data: existingTx } = await supabase
      .from("transactions")
      .select("id")
      .eq("order_id", orderId)
      .maybeSingle()

    if (existingTx?.id) {
      await supabase
        .from("transactions")
        .update({
          stripe_payment_intent_id: paymentIntentId,
          amount_cents: order.grand_total_cents,
          currency_code: order.currency_code,
          status: "authorized",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingTx.id)
    } else {
      await supabase.from("transactions").insert({
        order_id: orderId,
        stripe_payment_intent_id: paymentIntentId,
        amount_cents: order.grand_total_cents,
        currency_code: order.currency_code,
        status: "authorized",
      })
    }

    if (order.status === "accepted" || order.status === "pending") {
      await supabase
        .from("rental_orders")
        .update({ status: "paid", updated_at: new Date().toISOString() })
        .eq("id", orderId)

      await supabase
        .from("rental_items")
        .update({ status: "paid", updated_at: new Date().toISOString() })
        .eq("order_id", orderId)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Stripe confirm checkout error:", error)
    return NextResponse.json({ error: "Errore durante la conferma del pagamento" }, { status: 500 })
  }
}
