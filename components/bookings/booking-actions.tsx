"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, X, Play, Flag, Loader2 } from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"

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
  const { t } = useLanguage()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const updateStatus = async (action: string, loadingKey: string, notes?: string) => {
    setIsLoading(loadingKey)
    setError(null)

    try {
      const response = await fetch(`/api/bookings/${orderId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, notes }),
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error || t("booking_actions.update_error"))
      }

      router.refresh()
    } catch (err) {
      console.error("Error updating status:", err)
      setError(err instanceof Error ? err.message : t("booking_actions.update_error_retry"))
    } finally {
      setIsLoading(null)
    }
  }

  const startPayment = async () => {
    setIsLoading("pay")
    setError(null)

    try {
      const response = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, itemId }),
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error || t("booking_actions.payment_creation_error"))
      }

      if (payload.url) {
        router.push(payload.url)
        return
      }

      throw new Error(t("booking_actions.payment_session_unavailable"))
    } catch (err) {
      console.error("Error starting payment:", err)
      setError(err instanceof Error ? err.message : t("booking_actions.payment_error"))
    } finally {
      setIsLoading(null)
    }
  }

  // Owner actions for pending requests
  if (isOwner && currentStatus === "pending" && itemStatus === "requested") {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground">{t("booking_actions.title")}</h2>
        {error && (
          <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <div className="mt-4 flex gap-3">
          <button
            onClick={() => updateStatus("accept", "accept")}
            disabled={isLoading !== null}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent py-2.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90 disabled:opacity-50"
          >
            {isLoading === "accept" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {t("booking_actions.approve")}
          </button>
          <button
            onClick={() => updateStatus("reject", "reject")}
            disabled={isLoading !== null}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            {isLoading === "reject" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <X className="h-4 w-4" />
            )}
            {t("booking_actions.reject")}
          </button>
        </div>
      </div>
    )
  }

  // Renter action after owner acceptance
  if (isRenter && currentStatus === "accepted" && itemStatus === "accepted") {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground">{t("booking_actions.payment_title")}</h2>
        {error && (
          <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <p className="mt-2 text-sm text-muted-foreground">
          {t("booking_actions.owner_accepted")}
        </p>
        <button
          onClick={startPayment}
          disabled={isLoading !== null}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {isLoading === "pay" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {t("booking_actions.pay_now")}
        </button>
      </div>
    )
  }

  // Owner actions for paid requests
  if (isOwner && currentStatus === "paid" && itemStatus === "paid") {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground">{t("booking_actions.title")}</h2>
        {error && (
          <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <p className="mt-2 text-sm text-muted-foreground">
          {t("booking_actions.handover_hint")}
        </p>
        <button
          onClick={() => updateStatus("confirm_handover", "confirm_handover")}
          disabled={isLoading !== null}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {isLoading === "confirm_handover" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {t("booking_actions.confirm_handover")}
        </button>
      </div>
    )
  }

  // Owner actions for active rentals
  if (isOwner && currentStatus === "in_progress" && itemStatus === "collected") {
    const reportDamage = async () => {
      const notes = window.prompt(t("booking_actions.describe_damage_prompt")) || ""
      await updateStatus("report_damage", "report_damage", notes)
    }

    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground">{t("booking_actions.title")}</h2>
        {error && (
          <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <p className="mt-2 text-sm text-muted-foreground">
          {t("booking_actions.return_hint")}
        </p>
        <div className="mt-4 flex gap-3">
          <button
            onClick={() => updateStatus("mark_returned_ok", "mark_returned_ok")}
            disabled={isLoading !== null}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent py-2.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90 disabled:opacity-50"
          >
            {isLoading === "mark_returned_ok" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {t("booking_actions.returned_ok")}
          </button>
          <button
            onClick={reportDamage}
            disabled={isLoading !== null}
            className="flex items-center justify-center gap-2 rounded-lg border border-destructive px-4 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
          >
            {isLoading === "report_damage" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Flag className="h-4 w-4" />
            )}
            {t("booking_actions.report_issue")}
          </button>
        </div>
      </div>
    )
  }

  // Renter can cancel pending requests
  if (isRenter && currentStatus === "pending" && itemStatus === "requested") {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground">{t("booking_actions.title")}</h2>
        {error && (
          <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <button
          onClick={() => updateStatus("cancel_request", "cancel_request")}
          disabled={isLoading !== null}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-destructive py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
        >
          {isLoading === "cancel_request" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <X className="h-4 w-4" />
          )}
          {t("booking_actions.cancel_request")}
        </button>
      </div>
    )
  }

  // Completed or cancelled - no actions
  if (currentStatus === "completed" || currentStatus === "cancelled" || currentStatus === "disputed") {
    return null
  }

  return null
}

