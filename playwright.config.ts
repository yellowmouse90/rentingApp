import { defineConfig, devices } from "@playwright/test"
import { config as loadEnv } from "dotenv"
import path from "path"

// .env.test points at the local Supabase stack started by `pnpm test:db:up` / `test:db:reset`
// (see scripts/setup-test-db.mjs) rather than the real project in .env.local.
loadEnv({ path: path.resolve(__dirname, ".env.test") })

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Capped rather than left at the CPU-count default: most of these tests hit a single local
  // Postgres/GoTrue instance, and GoTrue's bcrypt hashing on every signup/login serializes under
  // load - high worker counts were observed to make some assertions (notification rows, log
  // lines) arrive later than their poll window, not because the underlying behavior is wrong.
  workers: process.env.CI ? 1 : 2,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Redirected to a file (rather than left on stdout) so tests can assert on fire-and-forget
    // server-side side effects that have no other observable surface - e.g. confirming a
    // notification email *attempt* happened (see tests/e2e/helpers/serverLog.ts) without a real
    // RESEND_API_KEY.
    command: "pnpm dev > .test-artifacts/dev-server.log 2>&1",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    env: process.env as Record<string, string>,
  },
})
