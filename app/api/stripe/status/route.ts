import { NextRequest, NextResponse } from "next/server"
import { requireApiUser } from "@/lib/auth/api"
import { syncStripeOnboardingStatus } from "@/lib/stripe"

export async function GET(request: NextRequest) {
  try {
    const { supabase, user, unauthorizedResponse } = await requireApiUser()

    if (!user) {
      return unauthorizedResponse as NextResponse
    }

    const { data: profile } = await supabase
      .schema("users_domain")
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

    // Get account details from Stripe and sync the cached flag if it drifted
    const { onboardingComplete, chargesEnabled, payoutsEnabled } = await syncStripeOnboardingStatus(
      supabase,
      user.id,
      profile.stripe_account_id,
      profile.stripe_onboarding_complete
    )

    return NextResponse.json({
      hasAccount: true,
      onboardingComplete,
      chargesEnabled,
      payoutsEnabled,
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

