import type { Page } from "@playwright/test"

// Drives the real login form (rather than hand-crafting @supabase/ssr's cookie format) so the
// resulting session cookie is set exactly the way the app itself sets it. Slower than injecting
// cookies directly, but immune to breaking whenever @supabase/ssr changes its cookie encoding.
export async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/auth/login")
  await page.locator("#email").fill(email)
  await page.locator("#password").fill(password)
  // Not selected by translated text: the login form's language depends on the browser's
  // reported locale (see lib/i18n/language-context.tsx), which Playwright defaults to en-US.
  await page.locator("form button[type=submit]").click()
  await page.waitForURL("/")
}
