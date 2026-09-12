import "server-only"

import Stripe from "stripe"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"
import { createNotification } from "@/lib/notifications/create"

let stripeInstance: Stripe | null = null

function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not set")
    }
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY)
  }
  return stripeInstance
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    return Reflect.get(getStripe(), prop, receiver)
  },
})

// Platform fee percentage (10%)
export const PLATFORM_FEE_PERCENT = 10

// An order was cancelled/rejected while a payment authorization was in flight (or arrived
// late via webhook after the order was already cancelled): void the hold instead of leaving
// funds authorized against a dead order, and record the transaction as failed.
export async function voidAuthorizationForCancelledOrder(
  supabase: SupabaseClient,
  orderId: string,
  paymentIntentId: string,
  amountCents: number,
  currencyCode: string
) {
  try {
    await stripe.paymentIntents.cancel(paymentIntentId)
  } catch (error) {
    console.error("Stripe: impossibile annullare il payment intent per l'ordine cancellato", orderId, error)
  }

  const now = new Date().toISOString()

  const { data: existingTx } = await supabase
    .schema("rentals_domain")
    .from("transactions")
    .select("id")
    .eq("order_id", orderId)
    .maybeSingle()

  if (existingTx?.id) {
    const { error } = await supabase
      .schema("rentals_domain")
      .from("transactions")
      .update({ stripe_payment_intent_id: paymentIntentId, status: "failed", updated_at: now })
      .eq("id", existingTx.id)
    if (error) {
      console.error("Stripe: aggiornamento transactions a 'failed' fallito", orderId, error)
    }
  } else {
    const { error } = await supabase.schema("rentals_domain").from("transactions").insert({
      order_id: orderId,
      stripe_payment_intent_id: paymentIntentId,
      amount_cents: amountCents,
      currency_code: currencyCode,
      status: "failed",
    })
    if (error) {
      console.error("Stripe: inserimento transactions 'failed' fallito", orderId, error)
    }
  }
}

// Records a checkout/webhook payment confirmation and moves the order to "paid".
//
// This always runs against the admin (service-role) client, never the user-scoped one: it is
// called both from the Stripe webhook (no user session at all) and from the client-triggered
// /api/stripe/confirm-checkout route. That second caller used to run these same writes with the
// renter's own session - RLS-gated - which silently dropped the rental_items update (the renter
// isn't rental_items.owner_id, so any owner-only UPDATE policy blocks it with 0 rows affected
// and no error), leaving the order stuck on "accepted" after a successful Stripe payment. By the
// time either caller reaches this function, authorization has already been established
// independently (Stripe signature for the webhook, session/user match for confirm-checkout), so
// bypassing RLS here is safe and matches how the webhook always worked.
export async function upsertAuthorizedTransaction(
  orderId: string,
  paymentIntentId: string
): Promise<"ok" | "order_not_found" | "cancelled"> {
  const supabase = createAdminClient()

  const { data: order } = await supabase
    .schema("rentals_domain")
    .from("rental_orders")
    .select("id, status, grand_total_cents, currency_code")
    .eq("id", orderId)
    .single()

  if (!order) {
    return "order_not_found"
  }

  if (order.status === "cancelled") {
    // The owner rejected (or the renter cancelled) while this payment was in flight: void the
    // authorization instead of recording held funds against a dead order.
    await voidAuthorizationForCancelledOrder(
      supabase,
      orderId,
      paymentIntentId,
      order.grand_total_cents,
      order.currency_code
    )
    return "cancelled"
  }

  const { data: existingTx } = await supabase
    .schema("rentals_domain")
    .from("transactions")
    .select("id, status")
    .eq("order_id", orderId)
    .maybeSingle()

  const now = new Date().toISOString()

  if (existingTx?.id) {
    const { error } = await supabase
      .schema("rentals_domain")
      .from("transactions")
      .update({
        stripe_payment_intent_id: paymentIntentId,
        amount_cents: order.grand_total_cents,
        currency_code: order.currency_code,
        status: existingTx.status === "captured" ? "captured" : "authorized",
        updated_at: now,
      })
      .eq("id", existingTx.id)
    if (error) {
      console.error("Stripe: aggiornamento transactions 'authorized' fallito", orderId, error)
    }
  } else {
    const { error } = await supabase.schema("rentals_domain").from("transactions").insert({
      order_id: orderId,
      stripe_payment_intent_id: paymentIntentId,
      amount_cents: order.grand_total_cents,
      currency_code: order.currency_code,
      status: "authorized",
    })
    if (error) {
      console.error("Stripe: inserimento transactions 'authorized' fallito", orderId, error)
    }
  }

  if (order.status === "accepted" || order.status === "pending") {
    // Guard the flip with the status value we actually read (same optimistic-concurrency
    // pattern as syncStripeOnboardingStatus below): the webhook and /api/stripe/confirm-checkout
    // both funnel through this function and can race on the same order (e.g. a webhook
    // redelivery overlapping a client-triggered confirm-checkout call). Only the caller whose
    // update actually affects a row proceeds to flip rental_items and send the
    // owner-facing "booking_paid" notification, so a race produces one notification, not two.
    const { data: orderFlipped, error: orderUpdateError } = await supabase
      .schema("rentals_domain")
      .from("rental_orders")
      .update({ status: "paid", updated_at: now })
      .eq("id", orderId)
      .eq("status", order.status)
      .select("id")
      .maybeSingle()

    if (orderUpdateError) {
      console.error("Stripe: aggiornamento rental_orders a 'paid' fallito", orderId, orderUpdateError)
    }

    if (orderFlipped) {
      const { error: itemsUpdateError } = await supabase
        .schema("rentals_domain")
        .from("rental_items")
        .update({ status: "paid", updated_at: now })
        .eq("order_id", orderId)

      if (itemsUpdateError) {
        console.error("Stripe: aggiornamento rental_items a 'paid' fallito", orderId, itemsUpdateError)
      }

      const { data: item } = await supabase
        .schema("rentals_domain")
        .from("rental_items")
        .select("owner_id")
        .eq("order_id", orderId)
        .maybeSingle()

      if (item?.owner_id) {
        await createNotification({
          recipientId: item.owner_id,
          actorId: null,
          type: "booking_paid",
          orderId,
        })
      }
    }
  }

  return "ok"
}

// Re-checks a Connect account's live status with Stripe and updates the cached
// `stripe_onboarding_complete` flag if it drifted. Pages call this after the user comes back
// from Stripe onboarding (the fastest of the two paths that keep this flag in sync - see the
// `account.updated` webhook handler for the other one), so it also races the webhook for the
// same false->true transition. The update is guarded on the value we actually read
// (`.eq("stripe_onboarding_complete", currentOnboardingComplete)`) so whichever of the two
// paths gets there first is the only one that both flips the row and sends the notification -
// the loser sees 0 rows affected and skips it, instead of the previous behavior where this
// path never sent a notification at all.
export async function syncStripeOnboardingStatus(
  supabase: SupabaseClient,
  userId: string,
  stripeAccountId: string,
  currentOnboardingComplete: boolean
): Promise<{ onboardingComplete: boolean; chargesEnabled: boolean; payoutsEnabled: boolean }> {
  try {
    const account = await stripe.accounts.retrieve(stripeAccountId)
    const onboardingComplete = Boolean(account.charges_enabled && account.payouts_enabled)

    if (onboardingComplete !== currentOnboardingComplete) {
      const { data: updated } = await supabase
        .schema("users_domain")
        .from("profiles")
        .update({ stripe_onboarding_complete: onboardingComplete })
        .eq("id", userId)
        .eq("stripe_onboarding_complete", currentOnboardingComplete)
        .select("id")
        .maybeSingle()

      if (updated && !currentOnboardingComplete && onboardingComplete) {
        await createNotification({
          recipientId: userId,
          actorId: null,
          type: "stripe_onboarding_complete",
        })
      }
    }

    return {
      onboardingComplete,
      chargesEnabled: Boolean(account.charges_enabled),
      payoutsEnabled: Boolean(account.payouts_enabled),
    }
  } catch (error) {
    console.error("Stripe: impossibile verificare lo stato dell'account Connect", stripeAccountId, error)
    return {
      onboardingComplete: currentOnboardingComplete,
      chargesEnabled: false,
      payoutsEnabled: false,
    }
  }
}

