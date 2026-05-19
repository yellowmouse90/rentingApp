import { NextRequest, NextResponse } from "next/server"
import { requireApiUser } from "@/lib/auth/api"
import { stripe } from "@/lib/stripe"

export async function GET(request: NextRequest) {
  try {
    const { supabase, user, unauthorizedResponse } = await requireApiUser()

    if (!user) {
      return unauthorizedResponse as NextResponse
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_account_id, stripe_onboarding_complete")
      .eq("id", user.id)
      .single()

    if (!profile?.stripe_account_id) {
      return NextResponse.json({
        hasAccount: false,
        onboardingComplete: false,
        chargesEnabled: false,
        payoutsEnabled: false,
      })
    }

    // Get account details from Stripe
    const account = await stripe.accounts.retrieve(profile.stripe_account_id)

    const onboardingComplete = account.charges_enabled && account.payouts_enabled

    // Update profile if status changed
    if (onboardingComplete !== profile.stripe_onboarding_complete) {
      await supabase
        .from("profiles")
        .update({ stripe_onboarding_complete: onboardingComplete })
        .eq("id", user.id)
    }

    return NextResponse.json({
      hasAccount: true,
      onboardingComplete,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      accountId: profile.stripe_account_id,
    })
  } catch (error) {
    console.error("Stripe status error:", error)
    return NextResponse.json(
      { error: "Errore durante il recupero dello stato" },
      { status: 500 }
    )
  }
}
