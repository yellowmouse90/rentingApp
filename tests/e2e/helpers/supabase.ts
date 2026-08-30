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
