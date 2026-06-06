import { redirect } from "next/navigation"
import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

interface PageAuthResult {
  supabase: SupabaseServerClient
  user: User
}

export async function requirePageUser(redirectTo: string): Promise<PageAuthResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/auth/login?redirect=${encodeURIComponent(redirectTo)}`)
  }

  return {
    supabase,
    user,
  }
}

