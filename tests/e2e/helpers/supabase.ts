import { createClient } from "@supabase/supabase-js"

// Talks directly to the local Supabase stack started by `pnpm test:db:up` / `test:db:reset`
// (see scripts/setup-test-db.mjs), bypassing RLS, so tests can seed fixtures the same way the
// app's own admin client (lib/supabase/admin.ts) would.
export function createTestAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing - is .env.test loaded (see playwright.config.ts) and is the local stack running (pnpm test:db:up)?"
    )
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// A real RLS-gated client authenticated as a given user, signed in directly against GoTrue
// rather than through the app's cookie-based session (see tests/e2e/helpers/auth.ts) - useful
// when a test wants to prove RLS itself is scoping rows, not just that an API route's own query
// filters them, without going through a Next.js route/cookies at all.
export async function createTestUserClient(email: string, password: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing - is .env.test loaded?")
  }

  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error

  return client
}
