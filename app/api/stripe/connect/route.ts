import { NextRequest, NextResponse } from "next/server"
import { requireApiUser } from "@/lib/auth/api"
import { stripe } from "@/lib/stripe"

export async function GET(request: NextRequest) {
  return NextResponse.json(
    { message: "Stripe connect endpoint. Use POST to start onboarding." },
    { status: 405 }
  )
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, user, unauthorizedResponse } = await requireApiUser()

    if (!user) {
      return unauthorizedResponse as NextResponse
    }

    // Get or create user profile
    const displayName =
      (user.user_metadata as { display_name?: string })?.display_name ||
      user.email?.split("@")[0] ||
      null

    const { data: profile, error: profileError } = await supabase
      .from("user_domain.profiles")
      .upsert(
        {
          id: user.id,
          email: user.email,
          display_name: displayName,
          avatar_url: null,
          bio: null,
          phone: null,
          is_verified: false,
          preferred_currency: "EUR",
          stripe_customer_id: null,
          stripe_account_id: null,
          stripe_onboarding_complete: false,
          average_rating_as_owner: 0,
          average_rating_as_renter: 0,
          total_reviews_as_owner: 0,
          total_reviews_as_renter: 0,
        },
        { onConflict: "id" }
      )
      .select()
      .single()

    if (profileError || !profile) {
      console.error("Stripe Connect error: could not get/create profile", profileError)
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
        .from("user_domain.profiles")
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

