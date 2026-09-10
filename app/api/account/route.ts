import { NextResponse } from "next/server"
import { requireApiUser } from "@/lib/auth/api"
import { createAdminClient } from "@/lib/supabase/admin"
import { getServerI18n } from "@/lib/i18n/server"
import { getBlockingOrderStatuses } from "@/lib/account/rules"

// Baked directly into profiles.display_name (see below) rather than left null with a
// per-viewer i18n fallback like the null-sender chat case (lib/i18n "chat.deleted_user") -
// every other place that reads a profile's display_name (listings, reviews, bookings)
// would otherwise need its own "was this account deleted" branch. The app's user-facing
// copy is Italian-first (see CLAUDE.md), so this one baked string follows that convention.
const DELETED_DISPLAY_NAME = "Utente eliminato"

/**
 * @swagger
 * /account:
 *   delete:
 *     tags: [Users]
 *     summary: Elimina (soft-delete) l'account del chiamante
 *     description: >
 *       Consentito solo se ogni rental_orders di cui l'utente è parte (come renter, o come owner
 *       tramite rental_items) è in uno stato finale - completed/cancelled/disputed, vedi
 *       lib/account/rules.ts. Non è una hard delete: gli annunci vengono disattivati, il profilo
 *       viene anonimizzato e marcato deleted_at (migration 015), e la riga auth.users viene
 *       soft-eliminata via Admin API (sessioni/refresh token revocati, login bloccato). Righe
 *       rental_orders/rental_items/transactions restano intatte come storico/audit trail.
 *     security:
 *       - supabaseSessionCookie: []
 *     responses:
 *       200:
 *         description: Account eliminato
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Ok' }
 *       401:
 *         description: Non autenticato
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       409:
 *         description: Esistono ordini non ancora in uno stato finale
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       500:
 *         description: Errore interno
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
export async function DELETE() {
  try {
    const { t } = await getServerI18n()
    const { supabase, user } = await requireApiUser()

    if (!user) {
      return NextResponse.json({ error: t("api.common.unauthorized") }, { status: 401 })
    }

    const { data: ordersAsRenter, error: renterOrdersError } = await supabase
      .schema("rentals_domain")
      .from("rental_orders")
      .select("status")
      .eq("renter_id", user.id)

    if (renterOrdersError) {
      console.error("Account deletion: lettura ordini come noleggiatore fallita", renterOrdersError)
      return NextResponse.json({ error: t("api.account.delete_error") }, { status: 500 })
    }

    const { data: ownedItems, error: ownedItemsError } = await supabase
      .schema("rentals_domain")
      .from("rental_items")
      .select("order_id")
      .eq("owner_id", user.id)

    if (ownedItemsError) {
      console.error("Account deletion: lettura noleggi come proprietario fallita", ownedItemsError)
      return NextResponse.json({ error: t("api.account.delete_error") }, { status: 500 })
    }

    const ownedOrderIds = Array.from(new Set((ownedItems || []).map((item) => item.order_id as string)))

    const { data: ordersAsOwner, error: ownerOrdersError } = ownedOrderIds.length
      ? await supabase
          .schema("rentals_domain")
          .from("rental_orders")
          .select("status")
          .in("id", ownedOrderIds)
      : { data: [] as { status: string }[], error: null }

    if (ownerOrdersError) {
      console.error("Account deletion: lettura stato ordini come proprietario fallita", ownerOrdersError)
      return NextResponse.json({ error: t("api.account.delete_error") }, { status: 500 })
    }

    const allStatuses = [...(ordersAsRenter || []), ...(ordersAsOwner || [])].map(
      (order) => order.status as string
    )

    if (getBlockingOrderStatuses(allStatuses).length > 0) {
      return NextResponse.json({ error: t("api.account.blocking_orders") }, { status: 409 })
    }

    const now = new Date().toISOString()

    // Deactivate every active listing first - same is_active/is_available flip the manual
    // "archive" route uses (app/api/listings/[id]/route.ts) - so the account looks and
    // behaves fully deleted (nothing bookable, nothing in search) even though the rows
    // themselves stay. Row-count check against the pre-read set catches an RLS no-op
    // (CLAUDE.md: a blocked UPDATE returns success with 0 rows, not an error) rather than
    // silently leaving listings live under a "deleted" account.
    const { data: activeListings, error: activeListingsError } = await supabase
      .schema("inventory_domain")
      .from("listings")
      .select("id")
      .eq("owner_id", user.id)
      .eq("is_active", true)

    if (activeListingsError) {
      console.error("Account deletion: lettura annunci attivi fallita", activeListingsError)
      return NextResponse.json({ error: t("api.account.delete_error") }, { status: 500 })
    }

    if (activeListings && activeListings.length > 0) {
      const { data: deactivated, error: deactivateError } = await supabase
        .schema("inventory_domain")
        .from("listings")
        .update({ is_active: false, is_available: false, updated_at: now })
        .eq("owner_id", user.id)
        .eq("is_active", true)
        .select("id")

      if (deactivateError || !deactivated || deactivated.length !== activeListings.length) {
        console.error(
          "Account deletion: disattivazione annunci fallita (permessi insufficienti sul database)",
          deactivateError
        )
        return NextResponse.json({ error: t("api.account.delete_error") }, { status: 500 })
      }
    }

    // Scrub personal data and mark the row deleted before touching auth.users below - if
    // this write is going to be blocked (RLS misconfiguration), the account must still be
    // able to log in afterwards rather than ending up disabled with nothing scrubbed.
    const scrubbedEmail = `deleted-${user.id}@deleted.invalid`
    const profileUpdated = await supabase
      .schema("users_domain")
      .from("profiles")
      .update({
        display_name: DELETED_DISPLAY_NAME,
        bio: null,
        phone: null,
        avatar_url: null,
        location_name: null,
        location_coords: null,
        email: scrubbedEmail,
        stripe_customer_id: null,
        stripe_account_id: null,
        stripe_onboarding_complete: false,
        deleted_at: now,
        updated_at: now,
      })
      .eq("id", user.id)
      .select("id")
      .single()

    if (profileUpdated.error || !profileUpdated.data) {
      console.error(
        "Account deletion: anonimizzazione profilo fallita (permessi insufficienti sul database)",
        profileUpdated.error
      )
      return NextResponse.json({ error: t("api.account.delete_error") }, { status: 500 })
    }

    // Admin API from here on - deleting/editing auth.users isn't reachable through
    // PostgREST/RLS at all (the auth schema isn't exposed), so this isn't a "bypass a
    // blocked write" shortcut, it's the only way to touch that table. Free the real email
    // up for reuse first (soft-deleting the auth user on its own leaves auth.users.email
    // as-is, permanently blocking re-signup with the same address), then soft-delete -
    // `shouldSoftDelete: true` keeps the auth.users row (unlike profiles, there's no
    // completed-order audit trail reason to keep it, but the row itself is tiny and this
    // avoids reintroducing the CASCADE-driven hard delete this migration moved away from)
    // while purging sessions/refresh tokens, which blocks further login immediately.
    const admin = createAdminClient()

    const { error: emailUpdateError } = await admin.auth.admin.updateUserById(user.id, {
      email: scrubbedEmail,
    })
    if (emailUpdateError) {
      console.error("Account deletion: liberazione email fallita", emailUpdateError)
      return NextResponse.json({ error: t("api.account.delete_error") }, { status: 500 })
    }

    const { error: softDeleteError } = await admin.auth.admin.deleteUser(user.id, true)
    if (softDeleteError) {
      // The profile is already scrubbed and the login email already changed to a value the
      // user doesn't know, so the account is practically inaccessible even though this last
      // step failed - log loudly for manual reconciliation rather than leaving it silent.
      console.error("Account deletion: soft-delete auth.users fallito", softDeleteError)
      return NextResponse.json({ error: t("api.account.delete_error") }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("DELETE /api/account error:", error)
    const { t } = await getServerI18n()
    return NextResponse.json({ error: t("api.common.internal_error") }, { status: 500 })
  }
}
