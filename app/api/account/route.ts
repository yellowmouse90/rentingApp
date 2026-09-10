import { NextResponse } from "next/server"
import { requireApiUser } from "@/lib/auth/api"
import { createAdminClient } from "@/lib/supabase/admin"
import { getServerI18n } from "@/lib/i18n/server"
import { getBlockingOrderStatuses } from "@/lib/account/rules"

/**
 * @swagger
 * /account:
 *   delete:
 *     tags: [Users]
 *     summary: Elimina l'account del chiamante
 *     description: >
 *       Consentito solo se ogni rental_orders di cui l'utente è parte (come renter, o come owner
 *       tramite rental_items) è in uno stato finale - completed/cancelled/disputed, vedi
 *       lib/account/rules.ts. Elimina la riga auth.users via Admin API: è l'unico modo per farlo
 *       (l'Admin API non è un modo per bypassare una RLS bloccante - lo schema auth non è
 *       raggiungibile via PostgREST/RLS). profiles.id -> auth.users(id) è ON DELETE CASCADE
 *       (db/migrations/000_baseline.sql), quindi rimuove a cascata anche profilo, annunci,
 *       rental_items/rental_orders, indirizzi e metodi di pagamento; conversations/messages
 *       restano ma con participant_one/two e sender_id impostati a NULL (migration 004).
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

    const admin = createAdminClient()
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)

    if (deleteError) {
      console.error("Account deletion: eliminazione utente fallita", deleteError)
      return NextResponse.json({ error: t("api.account.delete_error") }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("DELETE /api/account error:", error)
    const { t } = await getServerI18n()
    return NextResponse.json({ error: t("api.common.internal_error") }, { status: 500 })
  }
}
