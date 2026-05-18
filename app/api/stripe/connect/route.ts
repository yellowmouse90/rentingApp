import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { stripe } from "@/lib/stripe"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 })
    }

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, display_name, stripe_account_id")
      .eq("id", user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: "Profilo non trovato" }, { status: 404 })
    }

    let accountId = profile.stripe_account_id

    // Create Stripe Connect account if not exists
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "IT",
        email: profile.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: "individual",
        business_profile: {
          mcc: "7394", // Equipment rental
          product_description: "Noleggio attrezzi tra privati",
        },
      })

      accountId = account.id

      // Save to profile
      await supabase
        .from("profiles")
        .update({ stripe_account_id: accountId })
        .eq("id", user.id)
    }

    // Create onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${request.nextUrl.origin}/dashboard/payments?refresh=true`,
      return_url: `${request.nextUrl.origin}/dashboard/payments?success=true`,
      type: "account_onboarding",
    })

    return NextResponse.json({ url: accountLink.url })
  } catch (error) {
    console.error("Stripe Connect error:", error)
    return NextResponse.json(
      { error: "Errore durante la configurazione dei pagamenti" },
      { status: 500 }
    )
  }
}
