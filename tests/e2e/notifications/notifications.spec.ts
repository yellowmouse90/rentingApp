import { test, expect } from "@playwright/test"
import { loginAs } from "../helpers/auth"
import { createBookingScenario } from "../helpers/fixtures"
import { waitForServerLog } from "../helpers/serverLog"
import { createTestUserClient } from "../helpers/supabase"

// lib/notifications/create.ts/preferences.ts/email.ts all carry "server-only" (see
// tests/e2e/helpers/webhook.ts's header comment for why that rules out importing them directly),
// so every notification here is exercised through the real API route that triggers it.
//
// booking_accepted/booking_rejected/booking_cancelled_by_renter/booking_handover_confirmed/
// booking_damage_reported are covered here (they're pure DB-state-transition triggers, no
// Stripe). booking_returned_ok and payment_succeeded/payment_failed are asserted as small
// additions inside tests/e2e/stripe/stripe-payments.spec.ts and webhook.spec.ts instead of
// duplicating a full Stripe/Connect setup here just to trigger them.

async function getNotification(
  supabase: Awaited<ReturnType<typeof createBookingScenario>>["supabase"],
  recipientId: string,
  orderId: string
) {
  const { data } = await supabase
    .schema("notifications_domain")
    .from("notifications")
    .select("id, type, title, body, recipient_id, actor_id, related_order_id")
    .eq("recipient_id", recipientId)
    .eq("related_order_id", orderId)
    .maybeSingle()
  return data
}

test.describe("booking_requested (new request notification)", () => {
  test("renter requesting a booking notifies the owner, in-app and by email attempt", async ({ browser }) => {
    const scenario = await createBookingScenario({ orderStatus: "pending", itemStatus: "requested" })
    try {
      const renterContext = await browser.newContext()
      const renterPage = await renterContext.newPage()
      await loginAs(renterPage, scenario.renter.email, scenario.renter.password)

      const response = await renterPage.request.post(`/api/bookings/${scenario.orderId}/notify-request`)
      expect(response.ok()).toBeTruthy()

      const notification = await getNotification(scenario.supabase, scenario.owner.id, scenario.orderId)
      expect(notification?.type).toBe("booking_requested")
      expect(notification?.title).toBe("Nuova richiesta di noleggio")
      expect(notification?.actor_id).toBe(scenario.renter.id)

      // No real RESEND_API_KEY in .env.test (by design - see conversation history): this is the
      // only observable proof the email channel was actually attempted, not skipped because
      // nothing ever called createNotification() for this event (the original bug report).
      const attempted = await waitForServerLog(scenario.owner.email)
      expect(attempted).toBeTruthy()

      await renterContext.close()
    } finally {
      await scenario.cleanup()
    }
  })

  test("only the renter who made the request can trigger its notification", async ({ browser }) => {
    const scenario = await createBookingScenario({ orderStatus: "pending", itemStatus: "requested" })
    try {
      const ownerContext = await browser.newContext()
      const ownerPage = await ownerContext.newPage()
      await loginAs(ownerPage, scenario.owner.email, scenario.owner.password)

      const response = await ownerPage.request.post(`/api/bookings/${scenario.orderId}/notify-request`)
      expect(response.status()).toBe(403)

      const notification = await getNotification(scenario.supabase, scenario.owner.id, scenario.orderId)
      expect(notification).toBeNull()

      await ownerContext.close()
    } finally {
      await scenario.cleanup()
    }
  })
})

test.describe("notification preferences gate delivery", () => {
  test("disabling a type entirely suppresses both the in-app row and the email attempt", async ({ browser }) => {
    const scenario = await createBookingScenario({ orderStatus: "pending", itemStatus: "requested" })
    try {
      const ownerContext = await browser.newContext()
      const ownerPage = await ownerContext.newPage()
      await loginAs(ownerPage, scenario.owner.email, scenario.owner.password)

      const prefResponse = await ownerPage.request.put("/api/notifications/preferences", {
        data: { alertType: "booking_requested", inApp: false, email: false },
      })
      expect(prefResponse.ok()).toBeTruthy()

      const renterContext = await browser.newContext()
      const renterPage = await renterContext.newPage()
      await loginAs(renterPage, scenario.renter.email, scenario.renter.password)

      const response = await renterPage.request.post(`/api/bookings/${scenario.orderId}/notify-request`)
      expect(response.ok()).toBeTruthy()

      const notification = await getNotification(scenario.supabase, scenario.owner.id, scenario.orderId)
      expect(notification).toBeNull()

      const attempted = await waitForServerLog(scenario.owner.email, 2000)
      expect(attempted).toBeFalsy()

      await ownerContext.close()
      await renterContext.close()
    } finally {
      await scenario.cleanup()
    }
  })

  test("in-app only (email off) still creates the row but skips the email attempt", async ({ browser }) => {
    const scenario = await createBookingScenario({ orderStatus: "pending", itemStatus: "requested" })
    try {
      const ownerContext = await browser.newContext()
      const ownerPage = await ownerContext.newPage()
      await loginAs(ownerPage, scenario.owner.email, scenario.owner.password)

      const prefResponse = await ownerPage.request.put("/api/notifications/preferences", {
        data: { alertType: "booking_requested", inApp: true, email: false },
      })
      expect(prefResponse.ok()).toBeTruthy()

      const renterContext = await browser.newContext()
      const renterPage = await renterContext.newPage()
      await loginAs(renterPage, scenario.renter.email, scenario.renter.password)

      const response = await renterPage.request.post(`/api/bookings/${scenario.orderId}/notify-request`)
      expect(response.ok()).toBeTruthy()

      const notification = await getNotification(scenario.supabase, scenario.owner.id, scenario.orderId)
      expect(notification?.type).toBe("booking_requested")

      const attempted = await waitForServerLog(scenario.owner.email, 2000)
      expect(attempted).toBeFalsy()

      await ownerContext.close()
      await renterContext.close()
    } finally {
      await scenario.cleanup()
    }
  })
})

test.describe("RLS: notifications are only visible to their recipient", () => {
  test("RLS itself hides another user's notification, not just the API route's own query filter", async ({
    browser,
  }) => {
    const scenario = await createBookingScenario({ orderStatus: "pending", itemStatus: "requested" })
    try {
      const renterContext = await browser.newContext()
      const renterPage = await renterContext.newPage()
      await loginAs(renterPage, scenario.renter.email, scenario.renter.password)
      await renterPage.request.post(`/api/bookings/${scenario.orderId}/notify-request`)
      await renterContext.close()

      const notification = await getNotification(scenario.supabase, scenario.owner.id, scenario.orderId)
      expect(notification).not.toBeNull()

      // Signed in directly against GoTrue (not through the app/cookies) so this queries by id
      // directly, with no recipient_id filter of its own - if RLS is doing its job, the renter's
      // own session simply can never see this row, regardless of how it's queried.
      const renterClient = await createTestUserClient(scenario.renter.email, scenario.renter.password)
      const { data: asRenter } = await renterClient
        .schema("notifications_domain")
        .from("notifications")
        .select("id")
        .eq("id", notification!.id)
        .maybeSingle()
      expect(asRenter).toBeNull()

      const ownerClient = await createTestUserClient(scenario.owner.email, scenario.owner.password)
      const { data: asOwner } = await ownerClient
        .schema("notifications_domain")
        .from("notifications")
        .select("id")
        .eq("id", notification!.id)
        .maybeSingle()
      expect(asOwner?.id).toBe(notification!.id)
    } finally {
      await scenario.cleanup()
    }
  })
})

test.describe("transition-triggered notifications", () => {
  test("owner accepting notifies the renter (booking_accepted)", async ({ browser }) => {
    const scenario = await createBookingScenario({ orderStatus: "pending", itemStatus: "requested" })
    try {
      const ownerContext = await browser.newContext()
      const ownerPage = await ownerContext.newPage()
      await loginAs(ownerPage, scenario.owner.email, scenario.owner.password)

      await ownerPage.request.post(`/api/bookings/${scenario.orderId}/transition`, { data: { action: "accept" } })

      const notification = await getNotification(scenario.supabase, scenario.renter.id, scenario.orderId)
      expect(notification?.type).toBe("booking_accepted")
      expect(notification?.actor_id).toBe(scenario.owner.id)

      await ownerContext.close()
    } finally {
      await scenario.cleanup()
    }
  })

  test("owner rejecting notifies the renter (booking_rejected)", async ({ browser }) => {
    const scenario = await createBookingScenario({ orderStatus: "pending", itemStatus: "requested" })
    try {
      const ownerContext = await browser.newContext()
      const ownerPage = await ownerContext.newPage()
      await loginAs(ownerPage, scenario.owner.email, scenario.owner.password)

      await ownerPage.request.post(`/api/bookings/${scenario.orderId}/transition`, { data: { action: "reject" } })

      const notification = await getNotification(scenario.supabase, scenario.renter.id, scenario.orderId)
      expect(notification?.type).toBe("booking_rejected")

      await ownerContext.close()
    } finally {
      await scenario.cleanup()
    }
  })

  test("renter cancelling notifies the owner (booking_cancelled_by_renter)", async ({ browser }) => {
    const scenario = await createBookingScenario({ orderStatus: "pending", itemStatus: "requested" })
    try {
      const renterContext = await browser.newContext()
      const renterPage = await renterContext.newPage()
      await loginAs(renterPage, scenario.renter.email, scenario.renter.password)

      await renterPage.request.post(`/api/bookings/${scenario.orderId}/transition`, {
        data: { action: "cancel_request" },
      })

      const notification = await getNotification(scenario.supabase, scenario.owner.id, scenario.orderId)
      expect(notification?.type).toBe("booking_cancelled_by_renter")
      expect(notification?.actor_id).toBe(scenario.renter.id)

      await renterContext.close()
    } finally {
      await scenario.cleanup()
    }
  })

  test("confirm_handover notifies the renter (booking_handover_confirmed)", async ({ browser }) => {
    const scenario = await createBookingScenario({ orderStatus: "paid", itemStatus: "paid" })
    try {
      const ownerContext = await browser.newContext()
      const ownerPage = await ownerContext.newPage()
      await loginAs(ownerPage, scenario.owner.email, scenario.owner.password)

      await ownerPage.request.post(`/api/bookings/${scenario.orderId}/transition`, {
        data: { action: "confirm_handover" },
      })

      const notification = await getNotification(scenario.supabase, scenario.renter.id, scenario.orderId)
      expect(notification?.type).toBe("booking_handover_confirmed")

      await ownerContext.close()
    } finally {
      await scenario.cleanup()
    }
  })

  test("report_damage notifies the renter (booking_damage_reported)", async ({ browser }) => {
    const scenario = await createBookingScenario({ orderStatus: "in_progress", itemStatus: "collected" })
    try {
      const ownerContext = await browser.newContext()
      const ownerPage = await ownerContext.newPage()
      await loginAs(ownerPage, scenario.owner.email, scenario.owner.password)

      await ownerPage.request.post(`/api/bookings/${scenario.orderId}/transition`, {
        data: { action: "report_damage", notes: "Test damage" },
      })

      const notification = await getNotification(scenario.supabase, scenario.renter.id, scenario.orderId)
      expect(notification?.type).toBe("booking_damage_reported")

      await ownerContext.close()
    } finally {
      await scenario.cleanup()
    }
  })
})
