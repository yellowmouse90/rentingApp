"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, Clock } from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"
import type { ReviewContext, ReviewTargetRole } from "@/lib/types"
import { ReviewForm } from "./review-form"

interface RoleStatus {
  target_role: ReviewTargetRole
  reviewed: boolean
  visible: boolean
  can_submit: boolean
}

interface StatusResponse {
  booking_status: string
  context: ReviewContext
  window_open: boolean
  roles: RoleStatus[]
}

interface BookingReviewSectionProps {
  bookingId: string
}

// Only rendered by app/bookings/[id]/page.tsx once the order is
// "completed" - fetches /api/bookings/[id]/reviews/status to find out
// which role(s) the current user (renter and/or owner) can review, and
// shows either the form or a status line (spec sez. 5: "hai già
// recensito" / "in attesa della controparte" / "pubblicata").
export function BookingReviewSection({ bookingId }: BookingReviewSectionProps) {
  const { t } = useLanguage()
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/bookings/${bookingId}/reviews/status`)
      if (!response.ok) return
      setStatus(await response.json())
    } finally {
      setIsLoading(false)
    }
  }, [bookingId])

  useEffect(() => {
    load()
  }, [load])

  if (isLoading || !status || status.roles.length === 0) return null

  return (
    <div className="space-y-6">
      {status.roles.map((role) =>
        role.can_submit ? (
          <ReviewForm
            key={role.target_role}
            bookingId={bookingId}
            targetRole={role.target_role}
            context={status.context}
            onSubmitted={load}
          />
        ) : (
          <div key={role.target_role} className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground">
              {role.target_role === "lender" ? t("reviews.review_lender_cta") : t("reviews.review_renter_cta")}
            </h2>
            <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              {role.reviewed ? (
                <>
                  <Check className="h-4 w-4 text-emerald-500" />
                  {t("reviews.already_reviewed")} ·{" "}
                  {role.visible ? t("reviews.published") : t("reviews.awaiting_counterpart")}
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4" />
                  {t("reviews.window_closed")}
                </>
              )}
            </p>
          </div>
        )
      )}
    </div>
  )
}
