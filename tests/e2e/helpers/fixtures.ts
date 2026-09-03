import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createTestAdminClient } from "./supabase"

interface CreateUserOptions {
  displayName: string
}

export async function createTestUser(supabase: SupabaseClient, opts: CreateUserOptions) {
  const suffix = randomUUID().slice(0, 8)
  const { data, error } = await supabase.auth.admin.createUser({
    email: `test-${suffix}@example.com`,
    password: "test-password-123",
    email_confirm: true,
    user_metadata: { display_name: opts.displayName },
  })
  if (error || !data.user) throw error ?? new Error("createUser returned no user")
  return {
    id: data.user.id,
    email: data.user.email!,
    password: "test-password-123",
  }
}

export async function deleteTestUser(supabase: SupabaseClient, userId: string) {
  await supabase.auth.admin.deleteUser(userId)
}

interface CreateListingOptions {
  ownerId: string
  pricePerDayCents?: number
}

export async function createTestListing(supabase: SupabaseClient, opts: CreateListingOptions) {
  const suffix = randomUUID().slice(0, 8)

  const { data: category, error: categoryError } = await supabase
    .schema("inventory_domain")
    .from("categories")
    .insert({ name: `Test Category ${suffix}`, slug: `test-category-${suffix}` })
    .select()
    .single()
  if (categoryError || !category) throw categoryError

  const { data: listing, error: listingError } = await supabase
    .schema("inventory_domain")
    .from("listings")
    .insert({
      owner_id: opts.ownerId,
      category_id: category.id,
      title: `Test Listing ${suffix}`,
      condition: "good",
      price_per_day_cents: opts.pricePerDayCents ?? 1000,
      is_active: true,
      is_available: true,
    })
    .select()
    .single()
  if (listingError || !listing) throw listingError

  return { categoryId: category.id as string, listingId: listing.id as string }
}

export async function deleteTestListing(supabase: SupabaseClient, listingId: string, categoryId: string) {
  await supabase.schema("inventory_domain").from("listings").delete().eq("id", listingId)
  await supabase.schema("inventory_domain").from("categories").delete().eq("id", categoryId)
}

type OrderStatus = "pending" | "accepted" | "paid" | "in_progress" | "completed" | "cancelled" | "disputed"
type ItemStatus =
  | "requested"
  | "accepted"
  | "paid"
  | "collected"
  | "returned_ok"
  | "damaged"
  | "cancelled"
  | "unavailable"

interface CreateOrderOptions {
  renterId: string
  ownerId: string
  listingId: string
  orderStatus?: OrderStatus
  itemStatus?: ItemStatus
  dailyRateCents?: number
  totalDays?: number
}

// Seeds a rental_orders/rental_items pair directly at whatever status a test needs to start
// from (via the admin client, bypassing RLS - this is fixture setup, not the behavior under
// test). The real app only ever creates orders at pending/requested (see booking-form.tsx);
// later states are reached by driving app/api/bookings/[id]/transition, which IS what these
// tests exercise.
export async function createTestOrder(supabase: SupabaseClient, opts: CreateOrderOptions) {
  const dailyRate = opts.dailyRateCents ?? 1000
  const totalDays = opts.totalDays ?? 3
  const subtotal = dailyRate * totalDays
  const serviceFee = Math.round(subtotal * 0.1)
  const deposit = 0
  // The renter is charged the subtotal (+ deposit) only - the service fee is deducted from the
  // owner's payout instead, matching app/bookings/new/page.tsx and create-checkout/transition.
  const grandTotal = subtotal + deposit

  const { data: order, error: orderError } = await supabase
    .schema("rentals_domain")
    .from("rental_orders")
    .insert({
      renter_id: opts.renterId,
      status: opts.orderStatus ?? "pending",
      subtotal_cents: subtotal,
      service_fee_cents: serviceFee,
      total_deposit_cents: deposit,
      grand_total_cents: grandTotal,
      currency_code: "EUR",
    })
    .select()
    .single()
  if (orderError || !order) throw orderError

  const start = new Date()
  const end = new Date(start.getTime() + totalDays * 24 * 60 * 60 * 1000)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)

  const { data: item, error: itemError } = await supabase
    .schema("rentals_domain")
    .from("rental_items")
    .insert({
      order_id: order.id,
      listing_id: opts.listingId,
      owner_id: opts.ownerId,
      start_date: fmt(start),
      end_date: fmt(end),
      daily_rate_cents: dailyRate,
      total_days: totalDays,
      item_subtotal_cents: subtotal,
      deposit_cents: deposit,
      status: opts.itemStatus ?? "requested",
    })
    .select()
    .single()
  if (itemError || !item) throw itemError

  return {
    orderId: order.id as string,
    itemId: item.id as string,
    subtotalCents: subtotal,
    serviceFeeCents: serviceFee,
    grandTotalCents: grandTotal,
  }
}

export async function deleteTestOrder(supabase: SupabaseClient, orderId: string) {
  await supabase.schema("rentals_domain").from("transactions").delete().eq("order_id", orderId)
  await supabase.schema("rentals_domain").from("rental_items").delete().eq("order_id", orderId)
  await supabase.schema("rentals_domain").from("rental_orders").delete().eq("id", orderId)
}

// Full owner+renter+listing scaffold shared by most booking-lifecycle tests. `ownerStripe`
// lets Stripe-touching tests (checkout, capture) point the owner at a real Connect test account;
// tests that never reach Stripe can omit it.
export async function createBookingScenario(opts: {
  ownerStripeAccountId?: string
  orderStatus?: OrderStatus
  itemStatus?: ItemStatus
  pricePerDayCents?: number
  totalDays?: number
}) {
  const supabase = createTestAdminClient()

  const owner = await createTestUser(supabase, { displayName: "Owner Test" })
  const renter = await createTestUser(supabase, { displayName: "Renter Test" })

  if (opts.ownerStripeAccountId) {
    await supabase
      .schema("users_domain")
      .from("profiles")
      .update({
        stripe_account_id: opts.ownerStripeAccountId,
        stripe_onboarding_complete: true,
      })
      .eq("id", owner.id)
  }

  const { categoryId, listingId } = await createTestListing(supabase, {
    ownerId: owner.id,
    pricePerDayCents: opts.pricePerDayCents,
  })

  const order = await createTestOrder(supabase, {
    renterId: renter.id,
    ownerId: owner.id,
    listingId,
    orderStatus: opts.orderStatus,
    itemStatus: opts.itemStatus,
    totalDays: opts.totalDays,
  })

  return {
    supabase,
    owner,
    renter,
    categoryId,
    listingId,
    ...order,
    async cleanup() {
      await deleteTestOrder(supabase, order.orderId)
      await deleteTestListing(supabase, listingId, categoryId)
      await deleteTestUser(supabase, owner.id)
      await deleteTestUser(supabase, renter.id)
    },
  }
}
