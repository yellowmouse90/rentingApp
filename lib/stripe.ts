import "server-only"

import Stripe from "stripe"
import type { SupabaseClient } from "@supabase/supabase-js"

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
    await supabase
      .schema("rentals_domain")
      .from("transactions")
      .update({ stripe_payment_intent_id: paymentIntentId, status: "failed", updated_at: now })
      .eq("id", existingTx.id)
  } else {
    await supabase.schema("rentals_domain").from("transactions").insert({
      order_id: orderId,
      stripe_payment_intent_id: paymentIntentId,
      amount_cents: amountCents,
      currency_code: currencyCode,
      status: "failed",
    })
  }
}

// Re-checks a Connect account's live status with Stripe and updates the cached
// `stripe_onboarding_complete` flag if it drifted. Pages must call this after the user comes
// back from Stripe onboarding, since nothing else keeps that flag in sync (no `account.updated`
// webhook is configured).
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
      await supabase
        .schema("users_domain")
        .from("profiles")
        .update({ stripe_onboarding_complete: onboardingComplete })
        .eq("id", userId)
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

