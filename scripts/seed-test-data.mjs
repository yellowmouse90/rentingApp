// Populates the configured Supabase project with a coherent set of Italian-language test data:
// profiles (individuals + one business/"ferramenta" account), listings, rental orders covering
// every status in the booking lifecycle (each individual user shows up as both owner and renter
// across the set), transactions, reviews_domain rows exercising all three visibility paths
// (ferramenta immediate publish, p2p mutual reveal, p2p lone-hidden-awaiting-counterpart), a
// couple of chat conversations, and a handful of notifications.
//
// Written directly against the schemas via the admin (service-role) client, the same way
// tests/e2e/helpers/fixtures.ts seeds fixtures: this bypasses RLS on purpose (fixture setup, not
// app behavior under test) and lets rows be created straight at whatever lifecycle status is
// wanted instead of driving them there through app/api/bookings/[id]/transition one call at a
// time.
//
// Re-runnable: every run first deletes any profiles/auth users whose email ends in
// SEED_EMAIL_DOMAIN. Most seeded data cascade-deletes with the profile (listings/rental_orders/
// rental_items/transactions/reviews - see the ON DELETE CASCADE FKs in db/migrations/000 and
// 012), but interactions_domain.conversations deliberately does NOT (migration 004 nulls the
// participant instead, to preserve chat history for whoever is left) - those are deleted
// explicitly first so re-running this script never accumulates orphaned rows.
//
// Usage:
//   pnpm db:seed          # loads .env.local - the project `pnpm dev` talks to
//   pnpm db:seed:local    # loads .env.test  - the local `pnpm test:db:up` Supabase stack

import { config as loadEnv } from "dotenv"
import { createClient } from "@supabase/supabase-js"
import path from "node:path"

const root = path.resolve(import.meta.dirname, "..")
const envFile = process.argv.includes("--local") ? ".env.test" : ".env.local"
loadEnv({ path: path.join(root, envFile) })

const SEED_EMAIL_DOMAIN = "seed.rentingapp.test"
const DAY_MS = 24 * 60 * 60 * 1000
const NOW = new Date()

const daysAgo = (n) => new Date(NOW.getTime() - n * DAY_MS)
const daysFromNow = (n) => new Date(NOW.getTime() + n * DAY_MS)
const toDate = (d) => d.toISOString().slice(0, 10)
const toWkt = (lat, lng) => `POINT(${lng} ${lat})`

function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    const hint =
      envFile === ".env.test"
        ? "copy .env.test.example to .env.test and fill it in (see that file's own comments)"
        : "set it in .env.local (see .env.docker for the full list, and CLAUDE.md's 'Commands' section)"
    throw new Error(`${name} is missing - ${hint}.`)
  }
  return value
}

const supabase = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { autoRefreshToken: false, persistSession: false },
})

function must(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`)
  return result.data
}

// ---------------------------------------------------------------------------
// 1. Clean up any previous run
// ---------------------------------------------------------------------------

async function cleanupPreviousRun() {
  const oldProfiles = must(
    await supabase.schema("users_domain").from("profiles").select("id").ilike("email", `%@${SEED_EMAIL_DOMAIN}`),
    "cleanup: select previous seed profiles"
  )
  const ids = oldProfiles.map((p) => p.id)
  if (ids.length === 0) return

  await supabase.schema("interactions_domain").from("conversations").delete().in("participant_one", ids)
  await supabase.schema("interactions_domain").from("conversations").delete().in("participant_two", ids)

  for (const id of ids) {
    const { error } = await supabase.auth.admin.deleteUser(id)
    if (error) console.warn(`  ! could not delete previous seed user ${id}: ${error.message}`)
  }
  console.log(`Cleaned up ${ids.length} profile(s) from a previous run.`)
}

// ---------------------------------------------------------------------------
// 2. Categories
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { name: "Utensili elettrici", slug: "utensili-elettrici", icon_name: "Zap" },
  { name: "Utensili manuali", slug: "utensili-manuali", icon_name: "Hammer" },
  { name: "Giardinaggio", slug: "giardinaggio", icon_name: "Shovel" },
  { name: "Edilizia", slug: "edilizia", icon_name: "HardHat" },
  { name: "Trasporti", slug: "trasporti", icon_name: "Car" },
  { name: "Pulizia", slug: "pulizia", icon_name: "Sparkles" },
]

async function upsertCategories() {
  const rows = must(
    await supabase.schema("inventory_domain").from("categories").upsert(CATEGORIES, { onConflict: "slug" }).select("id, slug"),
    "upsert categories"
  )
  console.log(`Upserted ${rows.length} categories.`)
  return Object.fromEntries(rows.map((c) => [c.slug, c.id]))
}

// ---------------------------------------------------------------------------
// 3. Users
// ---------------------------------------------------------------------------

const USERS = [
  { key: "marco", displayName: "Marco Rossi", city: "Milano", lat: 45.4642, lng: 9.19, accountType: "individual" },
  { key: "giulia", displayName: "Giulia Bianchi", city: "Roma", lat: 41.9028, lng: 12.4964, accountType: "individual" },
  { key: "luca", displayName: "Luca Ferrari", city: "Torino", lat: 45.0703, lng: 7.6869, accountType: "individual" },
  { key: "sara", displayName: "Sara Conti", city: "Firenze", lat: 43.7696, lng: 11.2558, accountType: "individual" },
  { key: "andrea", displayName: "Andrea Esposito", city: "Napoli", lat: 40.8518, lng: 14.2681, accountType: "individual" },
  { key: "chiara", displayName: "Chiara Romano", city: "Bari", lat: 41.1171, lng: 16.8719, accountType: "individual" },
  { key: "davide", displayName: "Davide Greco", city: "Verona", lat: 45.4384, lng: 10.9916, accountType: "individual" },
  {
    key: "ferramenta",
    displayName: "Ferramenta Del Corso",
    city: "Bologna",
    lat: 44.4949,
    lng: 11.3426,
    accountType: "business",
    bio: "Ferramenta di quartiere a Bologna, noleggio attrezzi da cantiere e giardinaggio dal 1998.",
  },
]

const SEED_PASSWORD = "Seed-Test-Pwd123!"

async function createUsers() {
  const users = {}
  for (const u of USERS) {
    const email = `${u.key}@${SEED_EMAIL_DOMAIN}`
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: SEED_PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: u.displayName },
    })
    if (error || !data.user) throw new Error(`createUser(${email}): ${error?.message ?? "no user returned"}`)

    // users_domain.handle_new_user() (db/migrations/000_baseline.sql) already inserted a bare
    // profile row (id/email/display_name) via the auth.users trigger - fill in the rest.
    must(
      await supabase
        .schema("users_domain")
        .from("profiles")
        .update({
          bio: u.bio ?? null,
          is_verified: true,
          account_type: u.accountType,
          location_name: u.city,
          location_coords: toWkt(u.lat, u.lng),
        })
        .eq("id", data.user.id),
      `update profile ${u.key}`
    )

    users[u.key] = { id: data.user.id, email, ...u }
  }
  console.log(`Created ${Object.keys(users).length} users.`)
  return users
}

// ---------------------------------------------------------------------------
// 4. Listings
// ---------------------------------------------------------------------------

const LISTINGS = [
  {
    key: "trapano",
    ownerKey: "marco",
    category: "utensili-elettrici",
    title: "Trapano avvitatore Bosch 18V",
    description: "Trapano avvitatore a batteria con due batterie e valigetta, ottimo per lavori di bricolage.",
    condition: "good",
    priceDay: 800,
    priceWeek: 4000,
    deposit: 5000,
  },
  {
    key: "sega",
    ownerKey: "marco",
    category: "utensili-elettrici",
    title: "Sega circolare Makita",
    description: "Sega circolare professionale, lama da 190mm, come nuova.",
    condition: "like_new",
    priceDay: 1200,
    priceWeek: 6000,
    deposit: 8000,
  },
  {
    key: "martello",
    ownerKey: "marco",
    category: "edilizia",
    title: "Martello demolitore Hilti",
    description: "Martello demolitore per lavori di demolizione leggera, con punte a scalpello e puntale.",
    condition: "fair",
    priceDay: 3000,
    priceWeek: 15000,
    deposit: 20000,
  },
  {
    key: "levigatrice",
    ownerKey: "giulia",
    category: "utensili-elettrici",
    title: "Levigatrice orbitale",
    description: "Levigatrice orbitale con sacco raccogli-polvere e fogli abrasivi di ricambio.",
    condition: "good",
    priceDay: 600,
    priceWeek: 3000,
    deposit: 3000,
  },
  {
    key: "aspiratore",
    ownerKey: "giulia",
    category: "pulizia",
    title: "Aspiratore industriale Karcher",
    description: "Aspiratore solidi/liquidi da 30L, ideale per cantieri e pulizie post-ristrutturazione.",
    condition: "good",
    priceDay: 1000,
    priceWeek: 5000,
    deposit: 6000,
  },
  {
    key: "betoniera",
    ownerKey: "ferramenta",
    category: "edilizia",
    title: "Betoniera elettrica 130L",
    description: "Betoniera elettrica capacità 130L, ritiro e riconsegna direttamente in negozio.",
    condition: "good",
    priceDay: 2500,
    priceWeek: 12000,
    deposit: 15000,
  },
  {
    key: "tappezziera",
    ownerKey: "andrea",
    category: "pulizia",
    title: "Pulitrice a vapore per tappezzeria",
    description: "Pulitrice a vapore professionale per divani, materassi e tappeti.",
    condition: "fair",
    priceDay: 900,
    priceWeek: 4500,
    deposit: 4000,
  },
  {
    key: "avvitatore",
    ownerKey: "sara",
    category: "utensili-elettrici",
    title: "Avvitatore a batteria DeWalt",
    description: "Avvitatore a impulsi con due batterie 18V e caricabatterie rapido.",
    condition: "good",
    priceDay: 700,
    priceWeek: 3500,
    deposit: 4000,
  },
  {
    key: "idropulitrice",
    ownerKey: "chiara",
    category: "pulizia",
    title: "Idropulitrice ad alta pressione",
    description: "Idropulitrice 150 bar con lancia a getto variabile e accessorio per detergente.",
    condition: "like_new",
    priceDay: 1500,
    priceWeek: 7500,
    deposit: 10000,
  },
  {
    key: "scala",
    ownerKey: "davide",
    category: "edilizia",
    title: "Scala telescopica in alluminio",
    description: "Scala telescopica estensibile fino a 3.8m, molto compatta da trasportare.",
    condition: "good",
    priceDay: 500,
    priceWeek: 2500,
    deposit: 3000,
  },
  {
    key: "decespugliatore",
    ownerKey: "luca",
    category: "giardinaggio",
    title: "Decespugliatore a scoppio",
    description: "Decespugliatore a scoppio 4 tempi, con imbracatura e disco per rovi.",
    condition: "good",
    priceDay: 650,
    priceWeek: 3200,
    deposit: 3500,
  },
]

async function createListings(users, categoryIds) {
  const listings = {}
  for (const l of LISTINGS) {
    const owner = users[l.ownerKey]
    const row = must(
      await supabase
        .schema("inventory_domain")
        .from("listings")
        .insert({
          owner_id: owner.id,
          category_id: categoryIds[l.category],
          title: l.title,
          description: l.description,
          condition: l.condition,
          price_per_day_cents: l.priceDay,
          price_per_week_cents: l.priceWeek,
          deposit_cents: l.deposit,
          is_active: true,
          is_available: true,
          item_location_name: owner.city,
          item_coords: toWkt(owner.lat, owner.lng),
        })
        .select("id")
        .single(),
      `create listing ${l.key}`
    )
    listings[l.key] = { id: row.id, ...l, ownerId: owner.id }
  }
  console.log(`Created ${Object.keys(listings).length} listings.`)
  return listings
}

// ---------------------------------------------------------------------------
// 5. Rental orders (owner + renter both drawn from the same user pool, so
//    everyone appears on both sides of the marketplace across the full set)
// ---------------------------------------------------------------------------

const SERVICE_FEE_PERCENT = 10 // mirrors lib/stripe.ts PLATFORM_FEE_PERCENT

const ORDERS = [
  {
    key: "order1",
    listingKey: "trapano",
    renterKey: "giulia",
    orderStatus: "completed",
    itemStatus: "returned_ok",
    totalDays: 3,
    startsInDays: -10,
    createdDaysAgo: 12,
    completedDaysAgo: 6,
  },
  {
    key: "order2",
    listingKey: "betoniera",
    renterKey: "luca",
    orderStatus: "completed",
    itemStatus: "returned_ok",
    totalDays: 2,
    startsInDays: -8,
    createdDaysAgo: 9,
    completedDaysAgo: 5,
  },
  {
    key: "order3",
    listingKey: "avvitatore",
    renterKey: "andrea",
    orderStatus: "completed",
    itemStatus: "returned_ok",
    totalDays: 4,
    startsInDays: -9,
    createdDaysAgo: 11,
    completedDaysAgo: 4,
  },
  {
    key: "order4",
    listingKey: "idropulitrice",
    renterKey: "davide",
    orderStatus: "in_progress",
    itemStatus: "collected",
    totalDays: 5,
    startsInDays: -2,
    createdDaysAgo: 4,
    handedOverDaysAgo: 2,
  },
  {
    key: "order5",
    listingKey: "scala",
    renterKey: "marco",
    orderStatus: "paid",
    itemStatus: "paid",
    totalDays: 3,
    startsInDays: 2,
    createdDaysAgo: 1,
  },
  {
    key: "order6",
    listingKey: "tappezziera",
    renterKey: "sara",
    orderStatus: "accepted",
    itemStatus: "accepted",
    totalDays: 2,
    startsInDays: 5,
    createdDaysAgo: 1,
  },
  {
    key: "order7",
    listingKey: "levigatrice",
    renterKey: "chiara",
    orderStatus: "pending",
    itemStatus: "requested",
    totalDays: 1,
    startsInDays: 7,
    createdDaysAgo: 0,
  },
  {
    key: "order8",
    listingKey: "decespugliatore",
    renterKey: "davide",
    orderStatus: "cancelled",
    itemStatus: "cancelled",
    totalDays: 3,
    startsInDays: 10,
    createdDaysAgo: 3,
    notes: "Annullato dal proprietario: attrezzo diventato indisponibile.",
  },
  {
    key: "order9",
    listingKey: "martello",
    renterKey: "andrea",
    orderStatus: "disputed",
    itemStatus: "damaged",
    totalDays: 4,
    startsInDays: -6,
    createdDaysAgo: 8,
    handedOverDaysAgo: 6,
    disputedDaysAgo: 1,
    conditionNotes: "Punta dello scalpello rotta, restituito con danni evidenti non presenti alla consegna.",
  },
  {
    key: "order10",
    listingKey: "aspiratore",
    renterKey: "luca",
    orderStatus: "completed",
    itemStatus: "returned_ok",
    totalDays: 2,
    startsInDays: -15,
    createdDaysAgo: 16,
    completedDaysAgo: 10,
  },
]

async function createOrders(users, listings) {
  const orders = {}
  for (const o of ORDERS) {
    const listing = listings[o.listingKey]
    const renter = users[o.renterKey]
    const ownerId = listing.ownerId

    const subtotal = listing.priceDay * o.totalDays
    const serviceFee = Math.round((subtotal * SERVICE_FEE_PERCENT) / 100)
    const deposit = listing.deposit
    const grandTotal = subtotal + deposit

    const orderInsert = {
      renter_id: renter.id,
      status: o.orderStatus,
      subtotal_cents: subtotal,
      service_fee_cents: serviceFee,
      total_deposit_cents: deposit,
      grand_total_cents: grandTotal,
      currency_code: "EUR",
      notes: o.notes ?? null,
      created_at: daysAgo(o.createdDaysAgo).toISOString(),
      updated_at: (o.completedDaysAgo != null
        ? daysAgo(o.completedDaysAgo)
        : o.disputedDaysAgo != null
          ? daysAgo(o.disputedDaysAgo)
          : o.handedOverDaysAgo != null
            ? daysAgo(o.handedOverDaysAgo)
            : daysAgo(o.createdDaysAgo)
      ).toISOString(),
    }

    const order = must(
      await supabase.schema("rentals_domain").from("rental_orders").insert(orderInsert).select("id").single(),
      `create order ${o.key}`
    )

    const start = daysFromNow(o.startsInDays)
    const end = daysFromNow(o.startsInDays + o.totalDays)

    const itemInsert = {
      order_id: order.id,
      listing_id: listing.id,
      owner_id: ownerId,
      start_date: toDate(start),
      end_date: toDate(end),
      daily_rate_cents: listing.priceDay,
      total_days: o.totalDays,
      item_subtotal_cents: subtotal,
      deposit_cents: deposit,
      status: o.itemStatus,
      handed_over_at: o.handedOverDaysAgo != null ? daysAgo(o.handedOverDaysAgo).toISOString() : null,
      returned_at: o.completedDaysAgo != null ? daysAgo(o.completedDaysAgo).toISOString() : null,
      dispute_opened_at: o.disputedDaysAgo != null ? daysAgo(o.disputedDaysAgo).toISOString() : null,
      condition_notes: o.conditionNotes ?? null,
    }

    const item = must(
      await supabase.schema("rentals_domain").from("rental_items").insert(itemInsert).select("id").single(),
      `create rental item ${o.key}`
    )

    // Mirrors the real capture flow (app/api/bookings/[id]/transition): a transaction exists
    // once checkout succeeds ('authorized'), and only flips to 'captured' at mark_returned_ok
    // (order completed) - it stays 'authorized' through in_progress/disputed since capture
    // happens on return, not on handover, and report_damage never calls Stripe. Cancelled orders
    // never reach payment here, so they get no transaction row at all.
    let transactionId = null
    if (["paid", "in_progress", "disputed", "completed"].includes(o.orderStatus)) {
      const captured = o.orderStatus === "completed"
      const tx = must(
        await supabase
          .schema("rentals_domain")
          .from("transactions")
          .insert({
            order_id: order.id,
            stripe_payment_intent_id: `pi_seed_${o.key}`,
            amount_cents: grandTotal,
            platform_fee_cents: captured ? serviceFee : 0,
            currency_code: "EUR",
            status: captured ? "captured" : "authorized",
          })
          .select("id")
          .single(),
        `create transaction ${o.key}`
      )
      transactionId = tx.id
    }

    orders[o.key] = {
      id: order.id,
      itemId: item.id,
      transactionId,
      ownerId,
      renterId: renter.id,
      ownerKey: listing.ownerKey,
      renterKey: o.renterKey,
      status: o.orderStatus,
      completedAt: o.completedDaysAgo != null ? daysAgo(o.completedDaysAgo).toISOString() : null,
    }
  }
  console.log(`Created ${Object.keys(orders).length} rental orders (all lifecycle statuses represented).`)
  return orders
}

// ---------------------------------------------------------------------------
// 6. Reviews - three visibility paths from db/migrations/012:
//    ferramenta+lender publishes immediately, p2p needs both sides ("doppio
//    cieco"), a lone p2p review stays hidden awaiting its counterpart.
// ---------------------------------------------------------------------------

async function createReview({ bookingId, authorId, targetId, targetRole, context, rating, comment, tags }) {
  must(
    await supabase.schema("reviews_domain").from("reviews").insert({
      booking_id: bookingId,
      author_user_id: authorId,
      target_user_id: targetId,
      target_role: targetRole,
      context,
      overall_rating: rating,
      comment,
      tags,
    }),
    `create review (booking ${bookingId}, target_role ${targetRole})`
  )
}

async function createReviews(users, orders) {
  const order1 = orders.order1 // Marco (lender/individual) <- Giulia (renter) - p2p, mutual visible
  await createReview({
    bookingId: order1.id,
    authorId: users.giulia.id,
    targetId: users.marco.id,
    targetRole: "lender",
    context: "p2p",
    rating: 5,
    comment: "Trapano perfetto e Marco puntualissimo alla consegna, consigliatissimo!",
    tags: ["puntuale", "oggetto come descritto"],
  })
  await createReview({
    bookingId: order1.id,
    authorId: users.marco.id,
    targetId: users.giulia.id,
    targetRole: "renter",
    context: "p2p",
    rating: 5,
    comment: "Giulia molto affidabile, riconsegna impeccabile e in perfetto orario.",
    tags: ["affidabile", "ottima comunicazione"],
  })

  const order2 = orders.order2 // Ferramenta (business) <- Luca - ferramenta context
  await createReview({
    bookingId: order2.id,
    authorId: users.luca.id,
    targetId: users.ferramenta.id,
    targetRole: "lender",
    context: "ferramenta",
    rating: 4,
    comment: "Betoniera in ottimo stato, ritiro rapido direttamente in negozio.",
    tags: ["professionale", "attrezzo ben tenuto"],
  })
  await createReview({
    bookingId: order2.id,
    authorId: users.ferramenta.id,
    targetId: users.luca.id,
    targetRole: "renter",
    context: "ferramenta",
    rating: 5,
    comment: "Cliente puntuale, nessun problema alla riconsegna.",
    tags: ["puntuale"],
  })

  const order3 = orders.order3 // Sara (lender/individual) <- Andrea - p2p, lone review, still hidden
  await createReview({
    bookingId: order3.id,
    authorId: users.andrea.id,
    targetId: users.sara.id,
    targetRole: "lender",
    context: "p2p",
    rating: 4,
    comment: "Avvitatore ok, piccolo ritardo alla consegna ma nessun problema.",
    tags: ["oggetto come descritto"],
  })

  const order10 = orders.order10 // Giulia (lender/individual) <- Luca - p2p, mutual visible
  await createReview({
    bookingId: order10.id,
    authorId: users.luca.id,
    targetId: users.giulia.id,
    targetRole: "lender",
    context: "p2p",
    rating: 5,
    comment: "Aspiratore industriale potentissimo, Giulia gentilissima e disponibile.",
    tags: ["disponibile", "attrezzo ben tenuto"],
  })
  await createReview({
    bookingId: order10.id,
    authorId: users.giulia.id,
    targetId: users.luca.id,
    targetRole: "renter",
    context: "p2p",
    rating: 4,
    comment: "Tutto ok, riconsegna con qualche ora di ritardo ma avvisata per tempo.",
    tags: ["comunicazione ok"],
  })

  console.log("Created 7 reviews (mutual-visible x2, ferramenta one-way x2, lone-hidden x1... plus mirrors).")
}

// ---------------------------------------------------------------------------
// 7. Chat: one conversation per rental_order_id, a short exchange each
// ---------------------------------------------------------------------------

async function createConversation({ orderId, participantOneId, participantTwoId, messages }) {
  const conversation = must(
    await supabase
      .schema("interactions_domain")
      .from("conversations")
      .insert({
        rental_order_id: orderId,
        participant_one: participantOneId,
        participant_two: participantTwoId,
      })
      .select("id")
      .single(),
    `create conversation for order ${orderId}`
  )

  for (const m of messages) {
    must(
      await supabase
        .schema("interactions_domain")
        .from("messages")
        .insert({
          conversation_id: conversation.id,
          sender_id: m.senderId,
          content: m.content,
          is_read: m.isRead ?? true,
        }),
      `create message in conversation ${conversation.id}`
    )
  }
}

async function createConversations(users, orders) {
  const order1 = orders.order1
  await createConversation({
    orderId: order1.id,
    participantOneId: users.giulia.id,
    participantTwoId: users.marco.id,
    messages: [
      { senderId: users.giulia.id, content: "Ciao Marco! Il trapano è ancora disponibile per il weekend?" },
      { senderId: users.marco.id, content: "Ciao Giulia, sì disponibile! Ti aspetto sabato mattina." },
      { senderId: users.giulia.id, content: "Perfetto, grazie mille!" },
      { senderId: users.marco.id, content: "Di nulla, a sabato!" },
    ],
  })

  const order4 = orders.order4
  await createConversation({
    orderId: order4.id,
    participantOneId: users.davide.id,
    participantTwoId: users.chiara.id,
    messages: [
      { senderId: users.davide.id, content: "Ciao Chiara, confermo che sono passato a ritirare l'idropulitrice, tutto ok!" },
      { senderId: users.chiara.id, content: "Perfetto Davide, buon lavoro! Fammi sapere se hai bisogno di altro." },
      { senderId: users.davide.id, content: "Grazie, la riporto giovedì come da accordi.", isRead: false },
    ],
  })

  console.log("Created 2 conversations with sample messages.")
}

// ---------------------------------------------------------------------------
// 8. Notifications - a handful of realistic in-app notifications
// ---------------------------------------------------------------------------

async function createNotification({ recipientId, actorId, type, title, body, relatedOrderId, isRead = false }) {
  must(
    await supabase.schema("notifications_domain").from("notifications").insert({
      recipient_id: recipientId,
      actor_id: actorId,
      type,
      title,
      body,
      related_order_id: relatedOrderId ?? null,
      link_url: relatedOrderId ? `/bookings/${relatedOrderId}` : null,
      is_read: isRead,
    }),
    `create notification (${type} -> ${recipientId})`
  )
}

async function createNotifications(users, orders) {
  await createNotification({
    recipientId: users.giulia.id,
    actorId: users.chiara.id,
    type: "booking_requested",
    title: "Nuova richiesta di noleggio",
    body: `${users.chiara.displayName} ha inviato una richiesta di noleggio per un tuo annuncio.`,
    relatedOrderId: orders.order7.id,
  })
  await createNotification({
    recipientId: users.sara.id,
    actorId: users.andrea.id,
    type: "booking_accepted",
    title: "Prenotazione accettata",
    body: `${users.andrea.displayName} ha accettato la tua richiesta di noleggio.`,
    relatedOrderId: orders.order6.id,
  })
  await createNotification({
    recipientId: users.chiara.id,
    actorId: users.davide.id,
    type: "payment_succeeded",
    title: "Pagamento ricevuto",
    body: `Il pagamento per il noleggio con ${users.davide.displayName} è stato autorizzato.`,
    relatedOrderId: orders.order4.id,
  })
  await createNotification({
    recipientId: users.giulia.id,
    actorId: users.marco.id,
    type: "booking_returned_ok",
    title: "Noleggio completato",
    body: "Il tuo noleggio è stato completato: l'attrezzo è stato restituito integro.",
    relatedOrderId: orders.order1.id,
    isRead: true,
  })
  await createNotification({
    recipientId: users.andrea.id,
    actorId: users.marco.id,
    type: "booking_damage_reported",
    title: "Danno segnalato",
    body: `${users.marco.displayName} ha segnalato un danno per il noleggio del martello demolitore.`,
    relatedOrderId: orders.order9.id,
  })
  await createNotification({
    recipientId: users.marco.id,
    actorId: users.giulia.id,
    type: "review_received",
    title: "Nuova recensione ricevuta",
    body: `${users.giulia.displayName} ti ha lasciato una recensione.`,
    relatedOrderId: orders.order1.id,
    isRead: true,
  })

  console.log("Created 6 notifications.")
}

// ---------------------------------------------------------------------------

async function main() {
  console.log(`Seeding test data via ${envFile} (${requireEnv("NEXT_PUBLIC_SUPABASE_URL")})`)

  await cleanupPreviousRun()
  const categoryIds = await upsertCategories()
  const users = await createUsers()
  const listings = await createListings(users, categoryIds)
  const orders = await createOrders(users, listings)
  await createReviews(users, orders)
  await createConversations(users, orders)
  await createNotifications(users, orders)

  console.log("\nDone. Seed users (password for all: " + SEED_PASSWORD + "):")
  for (const u of USERS) {
    console.log(`  ${u.displayName.padEnd(24)} ${u.key}@${SEED_EMAIL_DOMAIN}${u.accountType === "business" ? "  (business)" : ""}`)
  }
}

main().catch((error) => {
  console.error("\nSeed failed:", error.message)
  process.exit(1)
})
