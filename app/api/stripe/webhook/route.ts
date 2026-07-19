import { NextRequest, NextResponse } from "next/server"
import type Stripe from "stripe"
import { stripe, upsertAuthorizedTransaction } from "@/lib/stripe"
import { createAdminClient } from "@/lib/supabase/admin"
import { createNotification } from "@/lib/notifications/create"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// The webhook has no request-scoped session/cookie to read a language
// preference from (it's a server-to-server call from Stripe, not a user
// request) - fall back to the app's default language, same as
// getServerLanguage() does when no cookie is present.
const WEBHOOK_NOTIFICATION_LANGUAGE = "it" as const

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

    const { data: order } = await supabase
      .schema("rentals_domain")
      .from("rental_orders")
      .select("renter_id")
      .eq("id", orderId)
      .maybeSingle()

    if (order?.renter_id) {
      await createNotification({
        recipientId: order.renter_id,
        actorId: null,
        type: "payment_succeeded",
        language: WEBHOOK_NOTIFICATION_LANGUAGE,
        orderId,
      })
    }

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

    const { data: order } = await supabase
      .schema("rentals_domain")
      .from("rental_orders")
      .select("renter_id")
      .eq("id", orderId)
      .maybeSingle()

    if (order?.renter_id) {
      await createNotification({
        recipientId: order.renter_id,
        actorId: null,
        type: "payment_failed",
        language: WEBHOOK_NOTIFICATION_LANGUAGE,
        orderId,
      })
    }
  }
}

// No account.updated webhook was configured before this - onboarding
// completion was only ever detected by polling (see
// syncStripeOnboardingStatus in lib/stripe.ts, called from dashboard pages).
// Reuses that exact same completion predicate (charges_enabled &&
// payouts_enabled) so the webhook and the polling fallback never disagree,
// and only notifies/writes on the incomplete -> complete transition so a
// resent event (Stripe can redeliver account.updated many times) doesn't
// produce duplicate notifications.
async function handleAccountUpdated(account: Stripe.Account) {
  const supabase = createAdminClient()

  const { data: profile } = await supabase
    .schema("users_domain")
    .from("profiles")
    .select("id, stripe_onboarding_complete")
    .eq("stripe_account_id", account.id)
    .maybeSingle()

  if (!profile || profile.stripe_onboarding_complete) return

  const onboardingComplete = Boolean(account.charges_enabled && account.payouts_enabled)
  if (!onboardingComplete) return

  await supabase
    .schema("users_domain")
    .from("profiles")
    .update({ stripe_onboarding_complete: true })
    .eq("id", profile.id)

  await createNotification({
    recipientId: profile.id,
    actorId: null,
    type: "stripe_onboarding_complete",
    language: WEBHOOK_NOTIFICATION_LANGUAGE,
  })
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

      // session.payment_status stays "unpaid" for capture_method: "manual" even after a
      // successful authorization (it only becomes "paid" once captured) - session.status
      // "complete" is the correct signal that checkout finished successfully.
      if (orderId && paymentIntentId && session.status === "complete") {
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

    if (event.type === "account.updated") {
      const account = event.data.object as Stripe.Account
      await handleAccountUpdated(account)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("Stripe webhook processing error:", error)
    return NextResponse.json({ error: "Errore durante elaborazione webhook" }, { status: 500 })
  }
}

