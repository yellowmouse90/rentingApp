import Link from "next/link"
import { CheckCircle } from "lucide-react"

interface BookingSuccessPageProps {
  params: Promise<{ id: string }>
}

export default async function BookingSuccessPage({ params }: BookingSuccessPageProps) {
  const { id } = await params

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md text-center">
        <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-accent/20">
            <CheckCircle className="h-8 w-8 text-accent" />
          </div>

          <h1 className="text-2xl font-bold text-foreground">Prenotazione confermata!</h1>
          
          <p className="mt-4 text-muted-foreground">
            La tua richiesta di noleggio e stata inviata con successo. Il proprietario ricevera una notifica e potra confermare la disponibilita.
          </p>

          <div className="mt-8 flex flex-col gap-3">
            <Link
              href={`/bookings/${id}`}
              className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Visualizza prenotazione
            </Link>
            <Link
              href="/listings"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Continua a esplorare
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
