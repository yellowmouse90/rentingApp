"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { Listing } from "@/lib/types"
import { formatPrice } from "@/lib/utils"
import { format } from "date-fns"
import { Loader2, AlertCircle } from "lucide-react"

interface BookingFormProps {
  listing: Listing
  owner: {
    id: string
    display_name: string
    avatar_url: string | null
    stripe_account_id: string | null
    stripe_onboarding_complete: boolean
  }
  startDate: Date
  endDate: Date
  totalDays: number
  subtotal: number
  serviceFee: number
  deposit: number
  grandTotal: number
}

export function BookingForm({
  listing,
  owner,
  startDate,
  endDate,
  totalDays,
  subtotal,
  serviceFee,
  deposit,
  grandTotal,
}: BookingFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push("/auth/login")
        return
      }

      // Create rental order
      const { data: order, error: orderError } = await supabase
        .from("rental_orders")
        .insert({
          renter_id: user.id,
          status: "pending",
          subtotal_cents: subtotal,
          service_fee_cents: serviceFee,
          total_deposit_cents: deposit,
          grand_total_cents: grandTotal,
          currency_code: listing.currency_code,
          notes: notes || null,
        })
        .select()
        .single()

      if (orderError) throw orderError

      // Create rental item
      const { error: itemError } = await supabase
        .from("rental_items")
        .insert({
          order_id: order.id,
          listing_id: listing.id,
          owner_id: listing.owner_id,
          start_date: format(startDate, "yyyy-MM-dd"),
          end_date: format(endDate, "yyyy-MM-dd"),
          daily_rate_cents: listing.price_per_day_cents,
          total_days: totalDays,
          item_subtotal_cents: subtotal,
          deposit_cents: deposit,
          status: "requested",
        })

      if (itemError) {
        // Rollback order
        await supabase.from("rental_orders").delete().eq("id", order.id)
        throw itemError
      }

      // Phase 1: request created, payment starts only after owner acceptance.
      router.push(`/bookings/${order.id}`)
    } catch (err) {
      console.error("Booking error:", err)
      setError("Errore durante la prenotazione. Riprova.")
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Owner payment status warning */}
      {!(owner.stripe_account_id && owner.stripe_onboarding_complete) && (
        <div className="flex items-start gap-3 rounded-lg bg-amber-50 p-4 text-amber-800">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Pagamento non disponibile</p>
            <p className="mt-1 text-sm">
              Il proprietario non ha ancora configurato i pagamenti. La prenotazione verra inviata come richiesta e dovrai concordare il pagamento direttamente.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-6">
        {error && (
          <div className="mb-6 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Notes */}
        <div>
          <label htmlFor="notes" className="mb-1.5 block text-sm font-medium text-foreground">
            Messaggio per il proprietario (opzionale)
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="Presentati e spiega per cosa ti serve l'attrezzo..."
          />
        </div>

        {/* Terms */}
        <div className="mt-6 rounded-lg bg-muted p-4">
          <h3 className="font-medium text-foreground">Termini del noleggio</h3>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            <li>• Ritiro e consegna da concordare con il proprietario</li>
            <li>• L&apos;attrezzo deve essere restituito nelle stesse condizioni</li>
            <li>• La cauzione viene rimborsata dopo la restituzione</li>
            <li>• Cancellazione gratuita fino a 24 ore prima</li>
          </ul>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-3 font-medium text-accent-foreground transition-colors hover:bg-accent/90 disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Elaborazione...
            </>
          ) : (
            "Invia richiesta di noleggio"
          )}
        </button>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Cliccando il pulsante accetti i{" "}
          <a href="/terms" className="underline hover:text-foreground">
            Termini di Servizio
          </a>{" "}
          e la{" "}
          <a href="/privacy" className="underline hover:text-foreground">
            Privacy Policy
          </a>
        </p>
      </form>
    </div>
  )
}
