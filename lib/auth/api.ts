import { NextResponse } from "next/server"
import type { User } from "@supabase/supabase-js"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

interface ApiAuthResult {
  supabase: SupabaseServerClient
  user: User | null
  unauthorizedResponse: NextResponse | null
}

// Native/mobile clients (no browser, no session cookie - see the Flutter app's ApiClient) send
// `Authorization: Bearer <access_token>` instead. Building the Supabase client with that token
// attached to every request (not just this one identity check) is what makes auth.uid() resolve
// correctly for RLS on every later .schema(...).from(...) call a route makes with the client this
// function returns - handing back a cookie-based (anon) client after only validating the token
// would just move the RLS silent-0-row failure mode (see CLAUDE.md) from "missing policy" to
// "missing session".
async function createBearerClient(token: string) {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function requireApiUser(): Promise<ApiAuthResult> {
  const headerList = await headers()
  const authHeader = headerList.get("authorization")
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null

  const supabase = bearerToken ? await createBearerClient(bearerToken) : await createClient()
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

