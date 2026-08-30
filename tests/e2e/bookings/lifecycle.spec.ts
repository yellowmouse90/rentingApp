import { test, expect } from "@playwright/test"
import { loginAs } from "../helpers/auth"
import { createBookingScenario } from "../helpers/fixtures"

// Exercises app/api/bookings/[id]/transition against the real local Postgres + RLS, logged in
// as real users (see tests/e2e/helpers/auth.ts) - this is exactly the code path that migrations
// 003/005/006/007 had to fix after RLS silently 0-rowed owner-side updates (see CLAUDE.md).
// None of these actions touch Stripe; the paid/capture states are covered separately in
// tests/e2e/bookings/payment-capture.spec.ts.

test.describe("booking transition: accept / reject", () => {
  test("owner accepts a pending request", async ({ browser }) => {
    const scenario = await createBookingScenario({ orderStatus: "pending", itemStatus: "requested" })
    try {
      const ownerContext = await browser.newContext()
      const ownerPage = await ownerContext.newPage()
      await loginAs(ownerPage, scenario.owner.email, scenario.owner.password)

      const response = await ownerPage.request.post(`/api/bookings/${scenario.orderId}/transition`, {
        data: { action: "accept" },
      })
      expect(response.ok()).toBeTruthy()
      expect(await response.json()).toEqual({ ok: true })

      const { data: order } = await scenario.supabase
        .schema("rentals_domain")
        .from("rental_orders")
        .select("status")
        .eq("id", scenario.orderId)
        .single()
      const { data: item } = await scenario.supabase
        .schema("rentals_domain")
        .from("rental_items")
        .select("status")
        .eq("id", scenario.itemId)
        .single()

      expect(order?.status).toBe("accepted")
      expect(item?.status).toBe("accepted")

      await ownerContext.close()
    } finally {
      await scenario.cleanup()
    }
  })

  test("renter cannot accept their own request", async ({ browser }) => {
    const scenario = await createBookingScenario({ orderStatus: "pending", itemStatus: "requested" })
    try {
      const renterContext = await browser.newContext()
      const renterPage = await renterContext.newPage()
      await loginAs(renterPage, scenario.renter.email, scenario.renter.password)

      const response = await renterPage.request.post(`/api/bookings/${scenario.orderId}/transition`, {
        data: { action: "accept" },
      })
      expect(response.status()).toBe(403)

      await renterContext.close()
    } finally {
      await scenario.cleanup()
    }
  })

  test("owner cannot accept an order that is already accepted", async ({ browser }) => {
    const scenario = await createBookingScenario({ orderStatus: "accepted", itemStatus: "accepted" })
    try {
      const ownerContext = await browser.newContext()
      const ownerPage = await ownerContext.newPage()
      await loginAs(ownerPage, scenario.owner.email, scenario.owner.password)

      const response = await ownerPage.request.post(`/api/bookings/${scenario.orderId}/transition`, {
        data: { action: "accept" },
      })
      expect(response.status()).toBe(400)

      await ownerContext.close()
    } finally {
      await scenario.cleanup()
    }
  })

  test("owner rejects a pending request", async ({ browser }) => {
    const scenario = await createBookingScenario({ orderStatus: "pending", itemStatus: "requested" })
    try {
      const ownerContext = await browser.newContext()
      const ownerPage = await ownerContext.newPage()
      await loginAs(ownerPage, scenario.owner.email, scenario.owner.password)

      const response = await ownerPage.request.post(`/api/bookings/${scenario.orderId}/transition`, {
        data: { action: "reject" },
      })
      expect(response.ok()).toBeTruthy()

      const { data: order } = await scenario.supabase
        .schema("rentals_domain")
        .from("rental_orders")
        .select("status")
        .eq("id", scenario.orderId)
        .single()
      const { data: item } = await scenario.supabase
        .schema("rentals_domain")
        .from("rental_items")
        .select("status")
        .eq("id", scenario.itemId)
        .single()

      expect(order?.status).toBe("cancelled")
      expect(item?.status).toBe("cancelled")

      await ownerContext.close()
    } finally {
      await scenario.cleanup()
    }
  })
})

test.describe("booking transition: cancel_request", () => {
  test("renter cancels their own pending request", async ({ browser }) => {
    const scenario = await createBookingScenario({ orderStatus: "pending", itemStatus: "requested" })
    try {
      const renterContext = await browser.newContext()
      const renterPage = await renterContext.newPage()
      await loginAs(renterPage, scenario.renter.email, scenario.renter.password)

      const response = await renterPage.request.post(`/api/bookings/${scenario.orderId}/transition`, {
        data: { action: "cancel_request" },
      })
      expect(response.ok()).toBeTruthy()

      const { data: order } = await scenario.supabase
        .schema("rentals_domain")
        .from("rental_orders")
        .select("status")
        .eq("id", scenario.orderId)
        .single()
      expect(order?.status).toBe("cancelled")

      await renterContext.close()
    } finally {
      await scenario.cleanup()
    }
  })

  test("owner cannot cancel the renter's request", async ({ browser }) => {
    const scenario = await createBookingScenario({ orderStatus: "pending", itemStatus: "requested" })
    try {
      const ownerContext = await browser.newContext()
      const ownerPage = await ownerContext.newPage()
      await loginAs(ownerPage, scenario.owner.email, scenario.owner.password)

      const response = await ownerPage.request.post(`/api/bookings/${scenario.orderId}/transition`, {
        data: { action: "cancel_request" },
      })
      expect(response.status()).toBe(403)

      await ownerContext.close()
    } finally {
      await scenario.cleanup()
    }
  })
})

test.describe("booking transition: confirm_handover", () => {
  test("owner confirms handover of a paid order", async ({ browser }) => {
    const scenario = await createBookingScenario({ orderStatus: "paid", itemStatus: "paid" })
    try {
      const ownerContext = await browser.newContext()
      const ownerPage = await ownerContext.newPage()
      await loginAs(ownerPage, scenario.owner.email, scenario.owner.password)

      const response = await ownerPage.request.post(`/api/bookings/${scenario.orderId}/transition`, {
        data: { action: "confirm_handover" },
      })
      expect(response.ok()).toBeTruthy()

      const { data: order } = await scenario.supabase
        .schema("rentals_domain")
        .from("rental_orders")
        .select("status")
        .eq("id", scenario.orderId)
        .single()
      const { data: item } = await scenario.supabase
        .schema("rentals_domain")
        .from("rental_items")
        .select("status, handed_over_at")
        .eq("id", scenario.itemId)
        .single()

      expect(order?.status).toBe("in_progress")
      expect(item?.status).toBe("collected")
      expect(item?.handed_over_at).not.toBeNull()

      await ownerContext.close()
    } finally {
      await scenario.cleanup()
    }
  })

  test("renter cannot confirm handover", async ({ browser }) => {
    const scenario = await createBookingScenario({ orderStatus: "paid", itemStatus: "paid" })
    try {
      const renterContext = await browser.newContext()
      const renterPage = await renterContext.newPage()
      await loginAs(renterPage, scenario.renter.email, scenario.renter.password)

      const response = await renterPage.request.post(`/api/bookings/${scenario.orderId}/transition`, {
        data: { action: "confirm_handover" },
      })
      expect(response.status()).toBe(403)

      await renterContext.close()
    } finally {
      await scenario.cleanup()
    }
  })

  test("cannot confirm handover of an order that isn't paid yet", async ({ browser }) => {
    const scenario = await createBookingScenario({ orderStatus: "accepted", itemStatus: "accepted" })
    try {
      const ownerContext = await browser.newContext()
      const ownerPage = await ownerContext.newPage()
      await loginAs(ownerPage, scenario.owner.email, scenario.owner.password)

      const response = await ownerPage.request.post(`/api/bookings/${scenario.orderId}/transition`, {
        data: { action: "confirm_handover" },
      })
      expect(response.status()).toBe(400)

      await ownerContext.close()
    } finally {
      await scenario.cleanup()
    }
  })
})

test.describe("booking transition: report_damage", () => {
  test("owner reports damage on an in-progress rental", async ({ browser }) => {
    const scenario = await createBookingScenario({ orderStatus: "in_progress", itemStatus: "collected" })
    try {
      const ownerContext = await browser.newContext()
      const ownerPage = await ownerContext.newPage()
      await loginAs(ownerPage, scenario.owner.email, scenario.owner.password)

      const response = await ownerPage.request.post(`/api/bookings/${scenario.orderId}/transition`, {
        data: { action: "report_damage", notes: "Manico rotto" },
      })
      expect(response.ok()).toBeTruthy()

      const { data: order } = await scenario.supabase
        .schema("rentals_domain")
        .from("rental_orders")
        .select("status")
        .eq("id", scenario.orderId)
        .single()
      const { data: item } = await scenario.supabase
        .schema("rentals_domain")
        .from("rental_items")
        .select("status, condition_notes, dispute_opened_at")
        .eq("id", scenario.itemId)
        .single()

      expect(order?.status).toBe("disputed")
      expect(item?.status).toBe("damaged")
      expect(item?.condition_notes).toBe("Manico rotto")
      expect(item?.dispute_opened_at).not.toBeNull()

      await ownerContext.close()
    } finally {
      await scenario.cleanup()
    }
  })

  test("renter cannot report damage", async ({ browser }) => {
    const scenario = await createBookingScenario({ orderStatus: "in_progress", itemStatus: "collected" })
    try {
      const renterContext = await browser.newContext()
      const renterPage = await renterContext.newPage()
      await loginAs(renterPage, scenario.renter.email, scenario.renter.password)

      const response = await renterPage.request.post(`/api/bookings/${scenario.orderId}/transition`, {
        data: { action: "report_damage" },
      })
      expect(response.status()).toBe(403)

      await renterContext.close()
    } finally {
      await scenario.cleanup()
    }
  })
})
