"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useLanguage } from "@/lib/i18n/language-context"
import { CreditCard, CheckCircle, AlertCircle, Loader2, ExternalLink } from "lucide-react"

interface StripeConnectCardProps {
  hasAccount: boolean
  onboardingComplete: boolean
}

export function StripeConnectCard({ hasAccount, onboardingComplete }: StripeConnectCardProps) {
  const { t } = useLanguage()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSetupPayments = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/stripe/connect", {
        method: "POST",
        credentials: "include",
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || `${t("dashboard.payments.card.error_status")} ${response.status}`)
        setIsLoading(false)
        return
      }

      if (data.url) {
        window.location.href = data.url
      }
    } catch (err) {
      setError(t("dashboard.payments.card.setup_error"))
      setIsLoading(false)
    }
  }

  if (onboardingComplete) {
    return (
      <div className="rounded-xl border border-accent/50 bg-accent/10 p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/20">
            <CheckCircle className="h-6 w-6 text-accent" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground">{t("dashboard.payments.card.active_title")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("dashboard.payments.card.active_description")}
            </p>
            <a
              href="https://dashboard.stripe.com"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline"
            >
              {t("dashboard.payments.card.stripe_dashboard")}
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    )
  }

  if (hasAccount && !onboardingComplete) {
    return (
      <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20">
            <AlertCircle className="h-6 w-6 text-amber-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground">{t("dashboard.payments.card.complete_title")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("dashboard.payments.card.complete_description")}
            </p>
            {error && (
              <p className="mt-2 text-sm text-destructive">{error}</p>
            )}
            <button
              onClick={handleSetupPayments}
              disabled={isLoading}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("common.loading")}
                </>
              ) : (
                <>
                  {t("dashboard.payments.card.complete_button")}
                  <ExternalLink className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <CreditCard className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-foreground">{t("dashboard.payments.card.setup_title")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("dashboard.payments.card.setup_description")}
          </p>
          {error && (
            <p className="mt-2 text-sm text-destructive">{error}</p>
          )}
          <button
            onClick={handleSetupPayments}
            disabled={isLoading}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("common.loading")}
              </>
            ) : (
              <>
                {t("dashboard.payments.card.setup_button")}
                <ExternalLink className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

