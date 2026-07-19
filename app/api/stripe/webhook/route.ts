import { NextRequest, NextResponse } from "next/server"
import type Stripe from "stripe"
import { stripe, upsertAuthorizedTransaction } from "@/lib/stripe"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function setTransactionStatusFromPaymentIntent(paymentIntent: Stripe.PaymentIntent) {
  const orderId = paymentIntent.metadata?.orderId
  if (!orderId) return

  const supabase = createAdminClient()
  const now = new Date().toISOString()

  if (paymentIntent.status === "requires_capture") {
    await upsertAuthorizedTransaction(orderId, paymentIntent.id)
    return
  }

  if (paymentIntent.status === "succeeded") {
    const latestChargeId = typeof paymentIntent.latest_charge === "string" ? paymentIntent.latest_charge : null
    let transferId: string | null = null

    if (latestChargeId) {
      const charge = await stripe.charges.retrieve(latestChargeId)
      transferId = typeof charge.transfer === "string" ? charge.transfer : null
    }

    await supabase
      .schema("rentals_domain")
      .from("transactions")
      .update({
        status: "captured",
        stripe_transfer_id: transferId,
        updated_at: now,
      })
      .eq("order_id", orderId)
    return
  }

  if (paymentIntent.status === "canceled") {
    await supabase
      .schema("rentals_domain")
      .from("transactions")
      .update({
        status: "failed",
        updated_at: now,
      })
      .eq("order_id", orderId)
    return
  }

  if (paymentIntent.status === "requires_payment_method") {
    await supabase
      .schema("rentals_domain")
      .from("transactions")
      .update({
        status: "requires_payment_method",
        updated_at: now,
      })
      .eq("order_id", orderId)
  }
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    return NextResponse.json({ error: "Stripe webhook secret non configurato" }, { status: 500 })
  }

  const signature = request.headers.get("stripe-signature")
  if (!signature) {
    return NextResponse.json({ error: "Stripe signature mancante" }, { status: 400 })
  }

  const payload = await request.text()

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret)
  } catch (error) {
    console.error("Stripe webhook signature error:", error)
    return NextResponse.json({ error: "Firma webhook non valida" }, { status: 400 })
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session
      const orderId = session.metadata?.orderId
      const paymentIntentId =
        typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id

      if (orderId && paymentIntentId && session.payment_status === "paid") {
        await upsertAuthorizedTransaction(orderId, paymentIntentId)
      }
    }

    if (
      event.type === "payment_intent.amount_capturable_updated" ||
      event.type === "payment_intent.succeeded" ||
      event.type === "payment_intent.canceled" ||
      event.type === "payment_intent.payment_failed"
    ) {
      const paymentIntent = event.data.object as Stripe.PaymentIntent
      await setTransactionStatusFromPaymentIntent(paymentIntent)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("Stripe webhook processing error:", error)
    return NextResponse.json({ error: "Errore durante elaborazione webhook" }, { status: 500 })
  }
}

