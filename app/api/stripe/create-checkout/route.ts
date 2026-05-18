import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { stripe, PLATFORM_FEE_PERCENT } from "@/lib/stripe"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 })
    }

    const { orderId, listingId, amount, currency, ownerStripeAccountId } = await request.json()

    if (!orderId || !amount || !currency || !ownerStripeAccountId) {
      return NextResponse.json({ error: "Parametri mancanti" }, { status: 400 })
    }

    // Calculate platform fee
    const platformFee = Math.round(amount * (PLATFORM_FEE_PERCENT / 100))

    // Create checkout session with destination charges
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: currency,
            unit_amount: amount,
            product_data: {
              name: "Noleggio attrezzo",
              description: `Ordine #${orderId.slice(0, 8)}`,
            },
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: platformFee,
        transfer_data: {
          destination: ownerStripeAccountId,
        },
      },
      success_url: `${request.nextUrl.origin}/bookings/${orderId}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${request.nextUrl.origin}/bookings/${orderId}`,
      metadata: {
        orderId,
        listingId,
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
