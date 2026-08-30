import { readFileSync } from "node:fs"
import path from "node:path"

// See playwright.config.ts's webServer.command - the dev server's stdout/stderr get redirected
// here instead of the terminal, so a test can assert on a fire-and-forget side effect that
// otherwise has no observable API surface (e.g. lib/notifications/email.ts's "no RESEND_API_KEY,
// skipping send" warning - the only proof an email attempt happened without a real Resend key).
const LOG_PATH = path.resolve(__dirname, "../../../.test-artifacts/dev-server.log")

export async function waitForServerLog(needle: string, timeoutMs = 10_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      if (readFileSync(LOG_PATH, "utf-8").includes(needle)) return true
    } catch {
      // Log file may not exist yet on the very first run.
    }
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  return false
}
