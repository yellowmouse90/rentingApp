"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Check, X, Play, Flag, Loader2 } from "lucide-react"

interface BookingActionsProps {
  orderId: string
  itemId: string
  currentStatus: string
  itemStatus: string
  isOwner: boolean
  isRenter: boolean
}

export function BookingActions({
  orderId,
  itemId,
  currentStatus,
  itemStatus,
  isOwner,
  isRenter,
}: BookingActionsProps) {
  const router = useRouter()
  const supabase = createClient()
  const [isLoading, setIsLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const updateStatus = async (newOrderStatus: string, newItemStatus: string) => {
    setIsLoading(newOrderStatus)
    setError(null)

    try {
      // Update order status
      const { error: orderError } = await supabase
        .from("rental_orders")
        .update({ status: newOrderStatus, updated_at: new Date().toISOString() })
        .eq("id", orderId)

      if (orderError) throw orderError

      // Update item status
      const { error: itemError } = await supabase
        .from("rental_items")
        .update({ status: newItemStatus, updated_at: new Date().toISOString() })
        .eq("id", itemId)

      if (itemError) throw itemError

      router.refresh()
    } catch (err) {
      console.error("Error updating status:", err)
      setError("Errore durante l'aggiornamento. Riprova.")
    } finally {
      setIsLoading(null)
    }
  }

  // Owner actions for pending requests
  if (isOwner && currentStatus === "pending") {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground">Azioni</h2>
        {error && (
          <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <div className="mt-4 flex gap-3">
          <button
            onClick={() => updateStatus("approved", "approved")}
            disabled={isLoading !== null}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent py-2.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90 disabled:opacity-50"
          >
            {isLoading === "approved" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Approva
          </button>
          <button
            onClick={() => updateStatus("cancelled", "cancelled")}
            disabled={isLoading !== null}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            {isLoading === "cancelled" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <X className="h-4 w-4" />
            )}
            Rifiuta
          </button>
        </div>
      </div>
    )
  }

  // Owner actions for approved requests
  if (isOwner && currentStatus === "approved") {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground">Azioni</h2>
        {error && (
          <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <p className="mt-2 text-sm text-muted-foreground">
          Quando consegni l&apos;attrezzo, segna il noleggio come iniziato.
        </p>
        <button
          onClick={() => updateStatus("ongoing", "ongoing")}
          disabled={isLoading !== null}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {isLoading === "ongoing" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          Inizia noleggio
        </button>
      </div>
    )
  }

  // Owner actions for ongoing rentals
  if (isOwner && currentStatus === "ongoing") {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground">Azioni</h2>
        {error && (
          <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <p className="mt-2 text-sm text-muted-foreground">
          Quando ricevi l&apos;attrezzo indietro, segna il noleggio come completato.
        </p>
        <div className="mt-4 flex gap-3">
          <button
            onClick={() => updateStatus("completed", "completed")}
            disabled={isLoading !== null}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent py-2.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90 disabled:opacity-50"
          >
            {isLoading === "completed" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Completa
          </button>
          <button
            onClick={() => updateStatus("disputed", "disputed")}
            disabled={isLoading !== null}
            className="flex items-center justify-center gap-2 rounded-lg border border-destructive px-4 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
          >
            {isLoading === "disputed" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Flag className="h-4 w-4" />
            )}
            Segnala problema
          </button>
        </div>
      </div>
    )
  }

  // Renter can cancel pending requests
  if (isRenter && currentStatus === "pending") {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground">Azioni</h2>
        {error && (
          <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <button
          onClick={() => updateStatus("cancelled", "cancelled")}
          disabled={isLoading !== null}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-destructive py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
        >
          {isLoading === "cancelled" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <X className="h-4 w-4" />
          )}
          Annulla richiesta
        </button>
      </div>
    )
  }

  // Completed or cancelled - no actions
  if (currentStatus === "completed" || currentStatus === "cancelled") {
    return null
  }

  return null
}
