// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { DbErrorNotice } from "./db-error-notice"
import { ToastProvider } from "./toast-provider"
import { LanguageProvider } from "@/lib/i18n/language-context"

// LanguageProvider (required by ToastProvider, which DbErrorNotice's toast renders through)
// fetches category translations via the Supabase browser client on mount, and also checks for a
// logged-in user (via auth.getUser()) to sync their persisted language preference - mock it the
// same way the app's own admin/user-scoped clients get mocked in API route tests, so this stays
// a unit test instead of needing a real Supabase project (see CLAUDE.md's two-clients section).
// No user is signed in here, so the profile lookup itself is never reached.
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: null } }),
    },
    schema: () => ({
      from: () => ({
        select: () => ({
          in: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }),
  }),
}))

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <LanguageProvider>
      <ToastProvider>{ui}</ToastProvider>
    </LanguageProvider>
  )
}

describe("DbErrorNotice", () => {
  it("surfaces a query error as a toast", async () => {
    // Mount with no error first: ToastProvider's listener subscribes on its own effect, which
    // (React runs child effects before parent effects) would otherwise miss a toast emitted by
    // DbErrorNotice in the very same mount - not just a test artifact, this is also why the app
    // always has ToastProvider mounted well before any page's own error state changes.
    const { rerender } = renderWithProviders(<DbErrorNotice message={null} />)

    rerender(
      <LanguageProvider>
        <ToastProvider>
          <DbErrorNotice message="Errore di test" />
        </ToastProvider>
      </LanguageProvider>
    )

    expect(await screen.findByRole("alert")).toHaveTextContent("Errore di test")
  })

  it("renders nothing when there is no error", () => {
    renderWithProviders(<DbErrorNotice message={null} />)

    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
})
