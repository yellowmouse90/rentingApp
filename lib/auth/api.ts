import { NextResponse } from "next/server"
import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

interface ApiAuthResult {
  supabase: SupabaseServerClient
  user: User | null
  unauthorizedResponse: NextResponse | null
}

export async function requireApiUser(): Promise<ApiAuthResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      supabase,
      user: null,
      unauthorizedResponse: NextResponse.json({ error: "Non autorizzato" }, { status: 401 }),
    }
  }

  return {
    supabase,
    user,
    unauthorizedResponse: null,
  }
}
