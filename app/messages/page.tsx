import Link from "next/link"
import { requirePageUser } from "@/lib/auth/page"
import { MessageSquare, ChevronLeft } from "lucide-react"

interface MessagesPageProps {
  searchParams: Promise<{
    user?: string
    listing?: string
  }>
}

export default async function MessagesPage({ searchParams }: MessagesPageProps) {
  await requirePageUser("/messages")
  const params = await searchParams

  const hasContext = Boolean(params.user || params.listing)

  return (
    <div className="min-h-screen bg-muted/30 py-8">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <Link
          href="/bookings"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Torna ai noleggi
        </Link>

        <div className="mt-6 rounded-xl border border-border bg-card p-6 sm:p-8">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Messaggi</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                La sezione chat e in arrivo. Intanto puoi usare i dettagli noleggio per coordinarti.
              </p>
            </div>
          </div>

          {hasContext && (
            <div className="mt-6 rounded-lg bg-muted p-4 text-sm text-muted-foreground">
              Hai aperto questa pagina da un contesto specifico (utente/annuncio). Quando la chat sara attiva,
              troverai qui la conversazione gia precompilata.
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/bookings"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Vai ai noleggi
            </Link>
            <Link
              href="/listings"
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Vai agli annunci
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

