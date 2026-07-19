import { NextRequest, NextResponse } from "next/server"
import { requireApiUser } from "@/lib/auth/api"
import { stripe } from "@/lib/stripe"

interface TransitionPayload {
  action:
    | "accept"
    | "reject"
    | "cancel_request"
    | "confirm_handover"
    | "mark_returned_ok"
    | "report_damage"
  notes?: string
}

interface PageParams {
  params: Promise<{ id: string }>
}

// `.update()` without `.select()` never surfaces an error when RLS blocks the write - it just
// silently affects 0 rows, and the caller has no way to tell that apart from a real success.
// Chaining `.select().single()` makes a 0-row update fail loudly instead.
async function requireUpdate(
  promise: PromiseLike<{ data: unknown; error: { message: string } | null }>,
  label: string
): Promise<boolean> {
  const { data, error } = await promise
  if (error || !data) {
    console.error(`Booking transition: aggiornamento non riuscito (${label})`, error)
    return false
  }
  return true
}

export async function POST(request: NextRequest, { params }: PageParams) {
  try {
    const { id: orderId } = await params
    const { supabase, user, unauthorizedResponse } = await requireApiUser()

    if (!user) {
      return unauthorizedResponse as NextResponse
    }

    const payload = (await request.json()) as TransitionPayload

    if (!payload?.action) {
      return NextResponse.json({ error: "Azione mancante" }, { status: 400 })
    }

    const { data: order, error: orderError } = await supabase
      .schema("rentals_domain")
      .from("rental_orders")
      .select("id, renter_id, status, subtotal_cents, service_fee_cents")
      .eq("id", orderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: "Ordine non trovato" }, { status: 404 })
    }

    const { data: item, error: itemError } = await supabase
      .schema("rentals_domain")
      .from("rental_items")
      .select("id, owner_id, status")
      .eq("order_id", orderId)
      .single()

    if (itemError || !item) {
      return NextResponse.json({ error: "Dettaglio noleggio non trovato" }, { status: 404 })
    }

    const isOwner = item.owner_id === user.id
    const isRenter = order.renter_id === user.id
    const now = new Date().toISOString()
    const permissionErrorResponse = () =>
      NextResponse.json(
        { error: "Impossibile aggiornare lo stato dell'ordine (permessi insufficienti sul database)" },
        { status: 500 }
      )

    if (payload.action === "accept") {
      if (!isOwner) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 })
      if (order.status !== "pending" || item.status !== "requested") {
        return NextResponse.json({ error: "Stato non valido per accettare" }, { status: 400 })
      }

      const orderUpdated = await requireUpdate(
        supabase
          .schema("rentals_domain")
          .from("rental_orders")
          .update({ status: "accepted", updated_at: now })
          .eq("id", orderId)
          .select("id")
          .single(),
        "rental_orders.accept"
      )
      if (!orderUpdated) return permissionErrorResponse()

      const itemUpdated = await requireUpdate(
        supabase
          .schema("rentals_domain")
          .from("rental_items")
          .update({ status: "accepted", updated_at: now })
          .eq("id", item.id)
          .select("id")
          .single(),
        "rental_items.accept"
      )
      if (!itemUpdated) return permissionErrorResponse()

      return NextResponse.json({ ok: true })
    }

    if (payload.action === "reject") {
      if (!isOwner) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 })
      if (order.status !== "pending") {
        return NextResponse.json({ error: "Stato non valido per rifiutare" }, { status: 400 })
      }

      const orderUpdated = await requireUpdate(
        supabase
          .schema("rentals_domain")
          .from("rental_orders")
          .update({ status: "cancelled", updated_at: now })
          .eq("id", orderId)
          .select("id")
          .single(),
        "rental_orders.reject"
      )
      if (!orderUpdated) return permissionErrorResponse()

      const itemUpdated = await requireUpdate(
        supabase
          .schema("rentals_domain")
          .from("rental_items")
          .update({ status: "cancelled", updated_at: now })
          .eq("id", item.id)
          .select("id")
          .single(),
        "rental_items.reject"
      )
      if (!itemUpdated) return permissionErrorResponse()

      return NextResponse.json({ ok: true })
    }

    if (payload.action === "cancel_request") {
      if (!isRenter) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 })
      if (order.status !== "pending") {
        return NextResponse.json({ error: "Stato non valido per annullare" }, { status: 400 })
      }

      const orderUpdated = await requireUpdate(
        supabase
          .schema("rentals_domain")
          .from("rental_orders")
          .update({ status: "cancelled", updated_at: now })
          .eq("id", orderId)
          .select("id")
          .single(),
        "rental_orders.cancel_request"
      )
      if (!orderUpdated) return permissionErrorResponse()

      const itemUpdated = await requireUpdate(
        supabase
          .schema("rentals_domain")
          .from("rental_items")
          .update({ status: "cancelled", updated_at: now })
          .eq("id", item.id)
          .select("id")
          .single(),
        "rental_items.cancel_request"
      )
      if (!itemUpdated) return permissionErrorResponse()

      return NextResponse.json({ ok: true })
    }

    if (payload.action === "confirm_handover") {
      if (!isOwner) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 })
      if (order.status !== "paid" || item.status !== "paid") {
        return NextResponse.json({ error: "Stato non valido per la consegna" }, { status: 400 })
      }

      const orderUpdated = await requireUpdate(
        supabase
          .schema("rentals_domain")
          .from("rental_orders")
          .update({ status: "in_progress", updated_at: now })
          .eq("id", orderId)
          .select("id")
          .single(),
        "rental_orders.confirm_handover"
      )
      if (!orderUpdated) return permissionErrorResponse()

      const itemUpdated = await requireUpdate(
        supabase
          .schema("rentals_domain")
          .from("rental_items")
          .update({ status: "collected", handed_over_at: now, updated_at: now })
          .eq("id", item.id)
          .select("id")
          .single(),
        "rental_items.confirm_handover"
      )
      if (!itemUpdated) return permissionErrorResponse()

      return NextResponse.json({ ok: true })
    }

    if (payload.action === "mark_returned_ok") {
      if (!isOwner) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 })
      if (order.status !== "in_progress" || item.status !== "collected") {
        return NextResponse.json({ error: "Stato non valido per chiudere il noleggio" }, { status: 400 })
      }

      const { data: tx, error: txError } = await supabase
        .schema("rentals_domain")
        .from("transactions")
        .select("id, stripe_payment_intent_id")
        .eq("order_id", orderId)
        .eq("status", "authorized")
        .maybeSingle()

      if (txError || !tx?.stripe_payment_intent_id) {
        return NextResponse.json({ error: "Transazione autorizzata non trovata" }, { status: 400 })
      }

      const amountToCapture = Number(order.subtotal_cents || 0) + Number(order.service_fee_cents || 0)

      if (!Number.isFinite(amountToCapture) || amountToCapture <= 0) {
        return NextResponse.json({ error: "Importo di cattura non valido" }, { status: 400 })
      }

      const paymentIntent = await stripe.paymentIntents.capture(tx.stripe_payment_intent_id, {
        amount_to_capture: amountToCapture,
        // Re-assert the fee explicitly: it must never exceed the captured amount, and must
        // stay in sync with the fee computed at checkout time regardless of what was stored
        // on the PaymentIntent at authorization.
        application_fee_amount: Number(order.service_fee_cents || 0),
      })

      const latestChargeId = typeof paymentIntent.latest_charge === "string" ? paymentIntent.latest_charge : null
      let transferId: string | null = null

      if (latestChargeId) {
        const charge = await stripe.charges.retrieve(latestChargeId)
        transferId = typeof charge.transfer === "string" ? charge.transfer : null
      }

      const itemUpdated = await requireUpdate(
        supabase
          .schema("rentals_domain")
          .from("rental_items")
          .update({ status: "returned_ok", returned_at: now, updated_at: now })
          .eq("id", item.id)
          .select("id")
          .single(),
        "rental_items.mark_returned_ok"
      )
      if (!itemUpdated) return permissionErrorResponse()

      const orderUpdated = await requireUpdate(
        supabase
          .schema("rentals_domain")
          .from("rental_orders")
          .update({ status: "completed", updated_at: now })
          .eq("id", orderId)
          .select("id")
          .single(),
        "rental_orders.mark_returned_ok"
      )
      if (!orderUpdated) return permissionErrorResponse()

      const txUpdated = await requireUpdate(
        supabase
          .schema("rentals_domain")
          .from("transactions")
          .update({
            status: "captured",
            stripe_transfer_id: transferId,
            platform_fee_cents: Number(order.service_fee_cents || 0),
            updated_at: now,
          })
          .eq("id", tx.id)
          .select("id")
          .single(),
        "transactions.mark_returned_ok"
      )
      if (!txUpdated) return permissionErrorResponse()

      return NextResponse.json({ ok: true })
    }

    if (payload.action === "report_damage") {
      if (!isOwner) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 })
      if (order.status !== "in_progress" || item.status !== "collected") {
        return NextResponse.json({ error: "Stato non valido per aprire disputa" }, { status: 400 })
      }

      const itemUpdated = await requireUpdate(
        supabase
          .schema("rentals_domain")
          .from("rental_items")
          .update({
            status: "damaged",
            returned_at: now,
            dispute_opened_at: now,
            condition_notes: payload.notes?.trim() || null,
            updated_at: now,
          })
          .eq("id", item.id)
          .select("id")
          .single(),
        "rental_items.report_damage"
      )
      if (!itemUpdated) return permissionErrorResponse()

      const orderUpdated = await requireUpdate(
        supabase
          .schema("rentals_domain")
          .from("rental_orders")
          .update({ status: "disputed", updated_at: now })
          .eq("id", orderId)
          .select("id")
          .single(),
        "rental_orders.report_damage"
      )
      if (!orderUpdated) return permissionErrorResponse()

      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: "Azione non supportata" }, { status: 400 })
  } catch (error) {
    console.error("Booking transition error:", error)
    return NextResponse.json({ error: "Errore durante l'aggiornamento dello stato" }, { status: 500 })
  }
}
