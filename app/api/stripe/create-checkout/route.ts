import { NextRequest, NextResponse } from "next/server"
import { requireApiUser } from "@/lib/auth/api"
import { stripe, PLATFORM_FEE_PERCENT } from "@/lib/stripe"

export async function POST(request: NextRequest) {
  try {
    const { supabase, user, unauthorizedResponse } = await requireApiUser()

    if (!user) {
      return unauthorizedResponse as NextResponse
    }

    const { orderId } = await request.json()

    if (!orderId) {
      return NextResponse.json({ error: "Parametri mancanti" }, { status: 400 })
    }

    const { data: order, error: orderError } = await supabase
      .from("rental_orders")
      .select("id, renter_id, status, grand_total_cents, currency_code")
      .eq("id", orderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: "Ordine non trovato" }, { status: 404 })
    }

    if (order.renter_id !== user.id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 403 })
    }

    if (order.status !== "accepted") {
      return NextResponse.json({ error: "L'ordine deve essere accettato prima del pagamento" }, { status: 400 })
    }

    const { data: item, error: itemError } = await supabase
      .from("rental_items")
      .select("listing_id, owner_id")
      .eq("order_id", orderId)
      .single()

    if (itemError || !item) {
      return NextResponse.json({ error: "Dettaglio noleggio non trovato" }, { status: 404 })
    }

    const { data: ownerProfile, error: ownerError } = await supabase
      .from("profiles")
      .select("stripe_account_id, stripe_onboarding_complete")
      .eq("id", item.owner_id)
      .single()

    if (ownerError || !ownerProfile?.stripe_account_id || !ownerProfile.stripe_onboarding_complete) {
      return NextResponse.json({ error: "Il proprietario non puo ricevere pagamenti online" }, { status: 400 })
    }

    const { data: listing } = await supabase
      .schema("inventory_domain")
      .from("listings")
      .select("title")
      .eq("id", item.listing_id)
      .single()

    const amount = order.grand_total_cents
    const currency = String(order.currency_code || "EUR").trim().toLowerCase()
    const platformFee = Math.round(amount * (PLATFORM_FEE_PERCENT / 100))

    // Create checkout session with manual capture: funds are authorized, not captured.
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: currency,
            unit_amount: amount,
            product_data: {
              name: listing?.title || "Noleggio attrezzo",
              description: `Ordine #${orderId.slice(0, 8)}`,
            },
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        capture_method: "manual",
        metadata: {
          orderId,
          listingId: item.listing_id,
          userId: user.id,
        },
        application_fee_amount: platformFee,
        transfer_data: {
          destination: ownerProfile.stripe_account_id,
        },
      },
      success_url: `${request.nextUrl.origin}/bookings/${orderId}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${request.nextUrl.origin}/bookings/${orderId}`,
      metadata: {
        orderId,
        listingId: item.listing_id,
        userId: user.id,
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error("Stripe checkout error:", error)
    return NextResponse.json(
      { error: "Errore durante la creazione del pagamento" },
      { status: 500 }
    )
  }
}
