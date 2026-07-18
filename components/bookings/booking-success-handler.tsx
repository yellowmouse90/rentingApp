"use client"

import { useEffect, useState } from "react"
import { useLanguage } from "@/lib/i18n/language-context"

interface BookingSuccessHandlerProps {
  orderId: string
  sessionId: string | null
}

export function BookingSuccessHandler({ orderId, sessionId }: BookingSuccessHandlerProps) {
  const { t } = useLanguage()
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
          setMessage(payload.error || t("booking_success_handler.not_confirmed"))
          return
        }

        setMessage(t("booking_success_handler.confirmed"))
      } catch {
        if (!cancelled) {
          setMessage(t("booking_success_handler.confirm_error"))
        }
      }
    }

    confirmCheckout()

    return () => {
      cancelled = true
    }
  }, [orderId, sessionId, t])

  if (!sessionId || !message) {
    return null
  }

  return (
    <p className="mt-3 text-sm text-muted-foreground">{message}</p>
  )
}

