import { NextRequest, NextResponse } from "next/server"
import { requireApiUser } from "@/lib/auth/api"
import { deriveReviewContext, isWithinReviewWindow } from "@/lib/reviews/rules"
import type { ReviewTargetRole } from "@/lib/types"

interface PageParams {
  params: Promise<{ id: string }>
}

// Drives the "hai già recensito" / "in attesa della controparte" /
// "pubblicata" UI state (spec sez. 5) without ever exposing the
// counterpart's review content before it's meant to be visible - the
// underlying query relies on reviews_domain's RLS (visible=true OR
// author_user_id = me) to only ever surface rows this caller may see.
export async function GET(_request: NextRequest, { params }: PageParams) {
  try {
    const { id: bookingId } = await params
    const { supabase, user, unauthorizedResponse } = await requireApiUser()
    if (!user) return unauthorizedResponse as NextResponse

    const { data: order, error: orderError } = await supabase
      .schema("rentals_domain")
      .from("rental_orders")
      .select("id, renter_id, status, updated_at")
      .eq("id", bookingId)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: "Prenotazione non trovata" }, { status: 404 })
    }

    const { data: item, error: itemError } = await supabase
      .schema("rentals_domain")
      .from("rental_items")
      .select("id, owner_id")
      .eq("order_id", bookingId)
      .single()

    if (itemError || !item) {
      return NextResponse.json({ error: "Dettaglio noleggio non trovato" }, { status: 404 })
    }

    const isOwner = item.owner_id === user.id
    const isRenter = order.renter_id === user.id

    if (!isOwner && !isRenter) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 403 })
    }

    const { data: lenderProfile } = await supabase
      .schema("users_domain")
      .from("profiles")
      .select("account_type")
      .eq("id", item.owner_id)
      .maybeSingle()

    const context = deriveReviewContext((lenderProfile?.account_type as "individual" | "business") ?? "individual")

    const { data: reviews, error: reviewsError } = await supabase
      .schema("reviews_domain")
      .from("reviews")
      .select("id, author_user_id, target_role, visible, created_at")
      .eq("booking_id", bookingId)

    if (reviewsError) {
      console.error("Review status: lettura fallita", reviewsError)
      return NextResponse.json({ error: "Impossibile leggere lo stato delle recensioni" }, { status: 500 })
    }

    const myReviews = (reviews || []).filter((r) => r.author_user_id === user.id)
    const receivedVisible = (reviews || []).some((r) => r.author_user_id !== user.id && r.visible)

    const eligibleRoles: ReviewTargetRole[] = []
    if (isRenter) eligibleRoles.push("lender")
    if (isOwner) eligibleRoles.push("renter")

    const windowOpen = order.status === "completed" && isWithinReviewWindow(order.updated_at)

    return NextResponse.json({
      booking_status: order.status,
      context,
      window_open: windowOpen,
      window_expires_at: windowOpen
        ? new Date(new Date(order.updated_at).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString()
        : null,
      received_review_visible: receivedVisible,
      roles: eligibleRoles.map((role) => {
        const mine = myReviews.find((r) => r.target_role === role)
        return {
          target_role: role,
          reviewed: Boolean(mine),
          visible: mine?.visible ?? false,
          can_submit: windowOpen && !mine,
        }
      }),
    })
  } catch (error) {
    console.error("Review status API error:", error)
    return NextResponse.json({ error: "Errore durante la lettura dello stato" }, { status: 500 })
  }
}
