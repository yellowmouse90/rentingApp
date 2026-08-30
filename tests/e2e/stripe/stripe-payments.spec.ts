import { test, expect } from "@playwright/test"
import Stripe from "stripe"
import { randomUUID } from "node:crypto"
import { loginAs } from "../helpers/auth"
import { createBookingScenario } from "../helpers/fixtures"
import { getTestStripe, createTestConnectAccount, deleteTestConnectAccount } from "../helpers/stripe"
import { postSignedWebhook } from "../helpers/webhook"

// Real Stripe test-mode throughout (per project decision - see conversation history): a
// throwaway Connect account is created once for this whole file (verification takes a few
// seconds, see tests/e2e/helpers/stripe.ts) and reused across tests, rather than per test.
//
// lib/stripe.ts's upsertAuthorizedTransaction()/voidAuthorizationForCancelledOrder() can't be
// imported directly here (they carry the "server-only" marker, which throws unless resolved
// through Next's own bundler) - tests that need them go through a real signed webhook call
// instead (see tests/e2e/helpers/webhook.ts), the same as Stripe itself would trigger them.
test.describe.serial("Stripe payments (real test-mode API)", () => {
  let stripe: Stripe
  let connectAccountId: string

  test.beforeAll(async () => {
    // Connect test-account verification is fast but not instant (a few seconds, occasionally
    // longer - see tests/e2e/helpers/stripe.ts), well past the default 30s hook timeout.
    test.setTimeout(200_000)
    stripe = getTestStripe()
    connectAccountId = await createTestConnectAccount(stripe)
  })

  test.afterAll(async () => {
    await deleteTestConnectAccount(stripe, connectAccountId)
  })

  test("create-checkout builds a real Checkout Session with Connect transfer_data", async ({ browser }) => {
    const scenario = await createBookingScenario({
      ownerStripeAccountId: connectAccountId,
      orderStatus: "accepted",
      itemStatus: "accepted",
    })
    try {
      const renterContext = await browser.newContext()
      const renterPage = await renterContext.newPage()
      await loginAs(renterPage, scenario.renter.email, scenario.renter.password)

      const response = await renterPage.request.post("/api/stripe/create-checkout", {
        data: { orderId: scenario.orderId },
      })
      expect(response.ok()).toBeTruthy()
      const body = await response.json()
      expect(body.url).toMatch(/^https:\/\/checkout\.stripe\.com\//)

      await renterContext.close()
    } finally {
      await scenario.cleanup()
    }
  })

  test("create-checkout rejects an order that isn't accepted yet", async ({ browser }) => {
    const scenario = await createBookingScenario({
      ownerStripeAccountId: connectAccountId,
      orderStatus: "pending",
      itemStatus: "requested",
    })
    try {
      const renterContext = await browser.newContext()
      const renterPage = await renterContext.newPage()
      await loginAs(renterPage, scenario.renter.email, scenario.renter.password)

      const response = await renterPage.request.post("/api/stripe/create-checkout", {
        data: { orderId: scenario.orderId },
      })
      expect(response.status()).toBe(400)

      await renterContext.close()
    } finally {
      await scenario.cleanup()
    }
  })

  test("create-checkout rejects a caller who isn't the renter", async ({ browser }) => {
    const scenario = await createBookingScenario({
      ownerStripeAccountId: connectAccountId,
      orderStatus: "accepted",
      itemStatus: "accepted",
    })
    try {
      const ownerContext = await browser.newContext()
      const ownerPage = await ownerContext.newPage()
      await loginAs(ownerPage, scenario.owner.email, scenario.owner.password)

      const response = await ownerPage.request.post("/api/stripe/create-checkout", {
        data: { orderId: scenario.orderId },
      })
      expect(response.status()).toBe(403)

      await ownerContext.close()
    } finally {
      await scenario.cleanup()
    }
  })

  test("create-checkout rejects an owner who hasn't finished Stripe onboarding", async ({ browser }) => {
    // No ownerStripeAccountId: profiles.stripe_onboarding_complete stays false (the fixture default).
    const scenario = await createBookingScenario({ orderStatus: "accepted", itemStatus: "accepted" })
    try {
      const renterContext = await browser.newContext()
      const renterPage = await renterContext.newPage()
      await loginAs(renterPage, scenario.renter.email, scenario.renter.password)

      const response = await renterPage.request.post("/api/stripe/create-checkout", {
        data: { orderId: scenario.orderId },
      })
      expect(response.status()).toBe(400)

      await renterContext.close()
    } finally {
      await scenario.cleanup()
    }
  })

  test("full payment lifecycle: authorize -> paid -> handover -> capture on mark_returned_ok", async ({
    browser,
    request,
  }) => {
    const scenario = await createBookingScenario({
      ownerStripeAccountId: connectAccountId,
      orderStatus: "accepted",
      itemStatus: "accepted",
    })
    try {
      // Authorize a real PaymentIntent against the real Connect account - this stands in for
      // what a shopper completing Stripe's hosted Checkout page would produce, without
      // automating that hosted UI (see conversation history for why).
      const paymentIntent = await stripe.paymentIntents.create({
        amount: scenario.grandTotalCents,
        currency: "eur",
        payment_method: "pm_card_visa",
        payment_method_types: ["card"],
        confirm: true,
        capture_method: "manual",
        application_fee_amount: scenario.serviceFeeCents,
        transfer_data: { destination: connectAccountId },
        metadata: { orderId: scenario.orderId, listingId: scenario.listingId, userId: scenario.renter.id },
      })
      expect(paymentIntent.status).toBe("requires_capture")

      // Same signal Stripe's real checkout.session.completed webhook would send once the
      // authorization succeeds - drives lib/stripe.ts's upsertAuthorizedTransaction() through
      // its real entry point (see tests/e2e/helpers/webhook.ts for why not a direct import).
      const webhookResponse = await postSignedWebhook(request, {
        id: `evt_${randomUUID()}`,
        object: "event",
        type: "checkout.session.completed",
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {
            id: `cs_test_${randomUUID()}`,
            object: "checkout.session",
            status: "complete",
            payment_status: "unpaid",
            payment_intent: paymentIntent.id,
            metadata: { orderId: scenario.orderId, listingId: scenario.listingId, userId: scenario.renter.id },
          },
        },
      })
      expect(webhookResponse.ok()).toBeTruthy()

      const { data: orderAfterAuth } = await scenario.supabase
        .schema("rentals_domain")
        .from("rental_orders")
        .select("status")
        .eq("id", scenario.orderId)
        .single()
      expect(orderAfterAuth?.status).toBe("paid")

      const { data: txAfterAuth } = await scenario.supabase
        .schema("rentals_domain")
        .from("transactions")
        .select("status, stripe_payment_intent_id")
        .eq("order_id", scenario.orderId)
        .single()
      expect(txAfterAuth?.status).toBe("authorized")
      expect(txAfterAuth?.stripe_payment_intent_id).toBe(paymentIntent.id)

      const ownerContext = await browser.newContext()
      const ownerPage = await ownerContext.newPage()
      await loginAs(ownerPage, scenario.owner.email, scenario.owner.password)

      const handoverResponse = await ownerPage.request.post(`/api/bookings/${scenario.orderId}/transition`, {
        data: { action: "confirm_handover" },
      })
      expect(handoverResponse.ok()).toBeTruthy()

      // The real assertion: mark_returned_ok calls stripe.paymentIntents.capture(...) for real
      // (see app/api/bookings/[id]/transition/route.ts) - this is the exact call whose ordering
      // relative to the rental_items/rental_orders writes migrations 005/007 had to fix.
      const returnResponse = await ownerPage.request.post(`/api/bookings/${scenario.orderId}/transition`, {
        data: { action: "mark_returned_ok" },
      })
      expect(returnResponse.ok()).toBeTruthy()

      const capturedIntent = await stripe.paymentIntents.retrieve(paymentIntent.id)
      expect(capturedIntent.status).toBe("succeeded")
      expect(capturedIntent.amount_received).toBe(scenario.grandTotalCents)

      const { data: order } = await scenario.supabase
        .schema("rentals_domain")
        .from("rental_orders")
        .select("status")
        .eq("id", scenario.orderId)
        .single()
      const { data: item } = await scenario.supabase
        .schema("rentals_domain")
        .from("rental_items")
        .select("status, returned_at")
        .eq("id", scenario.itemId)
        .single()
      const { data: tx } = await scenario.supabase
        .schema("rentals_domain")
        .from("transactions")
        .select("status, stripe_transfer_id, platform_fee_cents")
        .eq("order_id", scenario.orderId)
        .single()
      // This scenario also went through confirm_handover just above, which creates its own
      // booking_handover_confirmed notification for the same recipient/order - filtering on
      // type too (not just recipient+order) avoids maybeSingle() choking on the two rows.
      const { data: notification } = await scenario.supabase
        .schema("notifications_domain")
        .from("notifications")
        .select("type")
        .eq("recipient_id", scenario.renter.id)
        .eq("related_order_id", scenario.orderId)
        .eq("type", "booking_returned_ok")
        .maybeSingle()

      expect(order?.status).toBe("completed")
      expect(notification?.type).toBe("booking_returned_ok")
      expect(item?.status).toBe("returned_ok")
      expect(item?.returned_at).not.toBeNull()
      expect(tx?.status).toBe("captured")
      expect(tx?.stripe_transfer_id).toBeTruthy()
      expect(tx?.platform_fee_cents).toBe(scenario.serviceFeeCents)

      await ownerContext.close()
    } finally {
      await scenario.cleanup()
    }
  })

  test("an authorization is voided if the order was cancelled while payment was in flight", async ({ request }) => {
    const scenario = await createBookingScenario({
      ownerStripeAccountId: connectAccountId,
      orderStatus: "accepted",
      itemStatus: "accepted",
    })
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: scenario.grandTotalCents,
        currency: "eur",
        payment_method: "pm_card_visa",
        payment_method_types: ["card"],
        confirm: true,
        capture_method: "manual",
        application_fee_amount: scenario.serviceFeeCents,
        transfer_data: { destination: connectAccountId },
        metadata: { orderId: scenario.orderId, listingId: scenario.listingId, userId: scenario.renter.id },
      })
      expect(paymentIntent.status).toBe("requires_capture")

      // Simulates the owner rejecting (or the renter cancelling) while a Stripe authorization
      // from the hosted Checkout page is still in flight.
      await scenario.supabase
        .schema("rentals_domain")
        .from("rental_orders")
        .update({ status: "cancelled" })
        .eq("id", scenario.orderId)

      const webhookResponse = await postSignedWebhook(request, {
        id: `evt_${randomUUID()}`,
        object: "event",
        type: "checkout.session.completed",
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {
            id: `cs_test_${randomUUID()}`,
            object: "checkout.session",
            status: "complete",
            payment_status: "unpaid",
            payment_intent: paymentIntent.id,
            metadata: { orderId: scenario.orderId, listingId: scenario.listingId, userId: scenario.renter.id },
          },
        },
      })
      expect(webhookResponse.ok()).toBeTruthy()

      const cancelledIntent = await stripe.paymentIntents.retrieve(paymentIntent.id)
      expect(cancelledIntent.status).toBe("canceled")

      const { data: tx } = await scenario.supabase
        .schema("rentals_domain")
        .from("transactions")
        .select("status, stripe_payment_intent_id")
        .eq("order_id", scenario.orderId)
        .single()
      expect(tx?.status).toBe("failed")
      expect(tx?.stripe_payment_intent_id).toBe(paymentIntent.id)
    } finally {
      await scenario.cleanup()
    }
  })
})
