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
  workers: process.env.CI ? 1 : undefined,
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
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    env: process.env as Record<string, string>,
  },
})
