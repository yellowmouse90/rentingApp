"use client"

import { useEffect, useState } from "react"

interface BookingSuccessHandlerProps {
  orderId: string
  sessionId: string | null
}

export function BookingSuccessHandler({ orderId, sessionId }: BookingSuccessHandlerProps) {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) return

    let cancelled = false

    const confirmCheckout = async () => {
      try {
        const response = await fetch("/api/stripe/confirm-checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, sessionId }),
        })

        const payload = await response.json()

        if (cancelled) return

        if (!response.ok) {
          setMessage(payload.error || "Pagamento non ancora confermato")
          return
        }

        setMessage("Pagamento autorizzato con successo")
      } catch {
        if (!cancelled) {
          setMessage("Errore durante la conferma del pagamento")
        }
      }
    }

    confirmCheckout()

    return () => {
      cancelled = true
    }
  }, [orderId, sessionId])

  if (!sessionId || !message) {
    return null
  }

  return (
    <p className="mt-3 text-sm text-muted-foreground">{message}</p>
  )
}

