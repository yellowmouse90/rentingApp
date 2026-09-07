import { NextRequest, NextResponse } from "next/server"
import { requireApiUser } from "@/lib/auth/api"
import { syncStripeOnboardingStatus } from "@/lib/stripe"

/**
 * @swagger
 * /stripe/status:
 *   get:
 *     tags: [Stripe]
 *     summary: Stato onboarding/pagamenti Stripe Connect del chiamante
 *     description: >
 *       Sincronizza anche il flag profiles.stripe_onboarding_complete se risulta disallineato
 *       rispetto a Stripe (charges_enabled && payouts_enabled), con guardia di concorrenza
 *       ottimistica condivisa con il webhook account.updated.
 *     security:
 *       - supabaseSessionCookie: []
 *     responses:
 *       200:
 *         description: Stato corrente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 hasAccount: { type: boolean }
 *                 onboardingComplete: { type: boolean }
 *                 chargesEnabled: { type: boolean }
 *                 payoutsEnabled: { type: boolean }
 *                 accountId: { type: string, nullable: true }
 *       401:
 *         description: Non autenticato
 *       500:
 *         description: Errore interno
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
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

