import { test, expect } from "@playwright/test"
import { randomUUID } from "node:crypto"
import { createBookingScenario } from "../helpers/fixtures"
import { postSignedWebhook } from "../helpers/webhook"

// Signs payloads locally against STRIPE_WEBHOOK_SECRET (see tests/e2e/helpers/webhook.ts) - no
// network call to Stripe is needed to exercise signature verification or
// app/api/stripe/webhook/route.ts's own DB-writing logic.
test.describe("Stripe webhook", () => {
  test("rejects a payload with an invalid signature", async ({ request }) => {
    const response = await request.post("/api/stripe/webhook", {
      data: JSON.stringify({ id: "evt_fake", type: "checkout.session.completed", data: { object: {} } }),
      headers: { "content-type": "application/json", "stripe-signature": "t=1,v1=deadbeef" },
    })
    expect(response.status()).toBe(400)
  })

  test("checkout.session.completed moves an order from accepted to paid", async ({ request }) => {
    const scenario = await createBookingScenario({ orderStatus: "accepted", itemStatus: "accepted" })
    try {
      const fakePaymentIntentId = `pi_test_${randomUUID().replace(/-/g, "")}`

      const response = await postSignedWebhook(request, {
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
            payment_intent: fakePaymentIntentId,
            metadata: { orderId: scenario.orderId, listingId: scenario.listingId, userId: scenario.renter.id },
          },
        },
      })
      expect(response.ok()).toBeTruthy()

      const { data: order } = await scenario.supabase
        .schema("rentals_domain")
        .from("rental_orders")
        .select("status")
        .eq("id", scenario.orderId)
        .single()
      const { data: tx } = await scenario.supabase
        .schema("rentals_domain")
        .from("transactions")
        .select("status, stripe_payment_intent_id")
        .eq("order_id", scenario.orderId)
        .single()

      expect(order?.status).toBe("paid")
      expect(tx?.status).toBe("authorized")
      expect(tx?.stripe_payment_intent_id).toBe(fakePaymentIntentId)
    } finally {
      await scenario.cleanup()
    }
  })

  test("checkout.session.completed is ignored while the session is still open", async ({ request }) => {
    const scenario = await createBookingScenario({ orderStatus: "accepted", itemStatus: "accepted" })
    try {
      const response = await postSignedWebhook(request, {
        id: `evt_${randomUUID()}`,
        object: "event",
        type: "checkout.session.completed",
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {
            id: `cs_test_${randomUUID()}`,
            object: "checkout.session",
            status: "open",
            payment_status: "unpaid",
            payment_intent: `pi_test_${randomUUID().replace(/-/g, "")}`,
            metadata: { orderId: scenario.orderId, listingId: scenario.listingId, userId: scenario.renter.id },
          },
        },
      })
      expect(response.ok()).toBeTruthy()

      const { data: order } = await scenario.supabase
        .schema("rentals_domain")
        .from("rental_orders")
        .select("status")
        .eq("id", scenario.orderId)
        .single()
      expect(order?.status).toBe("accepted")
    } finally {
      await scenario.cleanup()
    }
  })

  test("payment_intent.payment_failed marks the transaction as failed", async ({ request }) => {
    const scenario = await createBookingScenario({ orderStatus: "accepted", itemStatus: "accepted" })
    try {
      const fakePaymentIntentId = `pi_test_${randomUUID().replace(/-/g, "")}`

      // Seed an "authorized" transaction first, the same way checkout.session.completed would
      // have (this route only updates an existing row by order_id, see setTransactionStatusFromPaymentIntent).
      await scenario.supabase.schema("rentals_domain").from("transactions").insert({
        order_id: scenario.orderId,
        stripe_payment_intent_id: fakePaymentIntentId,
        amount_cents: scenario.grandTotalCents,
        currency_code: "EUR",
        status: "authorized",
      })

      const response = await postSignedWebhook(request, {
        id: `evt_${randomUUID()}`,
        object: "event",
        type: "payment_intent.payment_failed",
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {
            id: fakePaymentIntentId,
            object: "payment_intent",
            status: "requires_payment_method",
            metadata: { orderId: scenario.orderId },
          },
        },
      })
      expect(response.ok()).toBeTruthy()

      const { data: tx } = await scenario.supabase
        .schema("rentals_domain")
        .from("transactions")
        .select("status")
        .eq("order_id", scenario.orderId)
        .single()
      expect(tx?.status).toBe("requires_payment_method")

      const { data: notification } = await scenario.supabase
        .schema("notifications_domain")
        .from("notifications")
        .select("type")
        .eq("recipient_id", scenario.renter.id)
        .eq("related_order_id", scenario.orderId)
        .maybeSingle()
      expect(notification?.type).toBe("payment_failed")
    } finally {
      await scenario.cleanup()
    }
  })

  test("payment_intent.succeeded marks the transaction as captured and notifies the renter", async ({ request }) => {
    const scenario = await createBookingScenario({ orderStatus: "paid", itemStatus: "paid" })
    try {
      const fakePaymentIntentId = `pi_test_${randomUUID().replace(/-/g, "")}`

      await scenario.supabase.schema("rentals_domain").from("transactions").insert({
        order_id: scenario.orderId,
        stripe_payment_intent_id: fakePaymentIntentId,
        amount_cents: scenario.grandTotalCents,
        currency_code: "EUR",
        status: "authorized",
      })

      // latest_charge intentionally omitted: the route only calls stripe.charges.retrieve() for
      // real when it's a string, and that exact call already gets real coverage in
      // stripe-payments.spec.ts's full payment lifecycle test (via mark_returned_ok, which hits
      // the same charges.retrieve pattern against a real charge).
      const response = await postSignedWebhook(request, {
        id: `evt_${randomUUID()}`,
        object: "event",
        type: "payment_intent.succeeded",
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {
            id: fakePaymentIntentId,
            object: "payment_intent",
            status: "succeeded",
            metadata: { orderId: scenario.orderId },
          },
        },
      })
      expect(response.ok()).toBeTruthy()

      const { data: tx } = await scenario.supabase
        .schema("rentals_domain")
        .from("transactions")
        .select("status")
        .eq("order_id", scenario.orderId)
        .single()
      expect(tx?.status).toBe("captured")

      const { data: notification } = await scenario.supabase
        .schema("notifications_domain")
        .from("notifications")
        .select("type")
        .eq("recipient_id", scenario.renter.id)
        .eq("related_order_id", scenario.orderId)
        .maybeSingle()
      expect(notification?.type).toBe("payment_succeeded")
    } finally {
      await scenario.cleanup()
    }
  })

  test("payment_intent.canceled marks the transaction as failed", async ({ request }) => {
    const scenario = await createBookingScenario({ orderStatus: "accepted", itemStatus: "accepted" })
    try {
      const fakePaymentIntentId = `pi_test_${randomUUID().replace(/-/g, "")}`

      await scenario.supabase.schema("rentals_domain").from("transactions").insert({
        order_id: scenario.orderId,
        stripe_payment_intent_id: fakePaymentIntentId,
        amount_cents: scenario.grandTotalCents,
        currency_code: "EUR",
        status: "authorized",
      })

      const response = await postSignedWebhook(request, {
        id: `evt_${randomUUID()}`,
        object: "event",
        type: "payment_intent.canceled",
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {
            id: fakePaymentIntentId,
            object: "payment_intent",
            status: "canceled",
            metadata: { orderId: scenario.orderId },
          },
        },
      })
      expect(response.ok()).toBeTruthy()

      const { data: tx } = await scenario.supabase
        .schema("rentals_domain")
        .from("transactions")
        .select("status")
        .eq("order_id", scenario.orderId)
        .single()
      expect(tx?.status).toBe("failed")
    } finally {
      await scenario.cleanup()
    }
  })
})
