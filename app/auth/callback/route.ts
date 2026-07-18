import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/"

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const displayName =
          (user.user_metadata as { display_name?: string })?.display_name ||
          user.email?.split("@")[0] ||
          null

        const { error: upsertError } = await supabase
          .schema("users_domain")
          .from("profiles")
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

        if (upsertError) {
          console.error("Auth callback profile upsert error:", upsertError)
          const redirectUrl = new URL(`${origin}${next}`)
          redirectUrl.searchParams.set("dbError", `Creazione profilo: ${upsertError.message}`)
          return NextResponse.redirect(redirectUrl)
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`)
}

