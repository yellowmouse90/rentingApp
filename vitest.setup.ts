import "@testing-library/jest-dom/vitest"
import { afterEach } from "vitest"
import { cleanup } from "@testing-library/react"

// vitest.config.ts doesn't set test.globals=true, so RTL's own auto-cleanup (which looks for a
// global afterEach) never registers - without this, DOM from one test/`it` block (and any toast
// timers still pending) leaks into the next.
afterEach(() => {
  cleanup()
})
