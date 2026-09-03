"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Star } from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"
import type { ReviewContext, ReviewTargetRole } from "@/lib/types"
import { Modal } from "@/components/ui/modal"
import { ReviewForm } from "./review-form"

interface ReviewButtonProps {
  bookingId: string
  targetRole: ReviewTargetRole
  context: ReviewContext
  onSubmitted?: () => void
  // "card" - full-width primary button (booking detail page).
  // "compact" - small pill, safe to drop into a card/list row that is
  // itself wrapped in a Link (stops the click from also triggering
  // navigation - see app/bookings/page.tsx).
  variant?: "card" | "compact"
}

export function ReviewButton({ bookingId, targetRole, context, onSubmitted, variant = "card" }: ReviewButtonProps) {
  const { t } = useLanguage()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const modalTitle = targetRole === "lender" ? t("reviews.review_lender_cta") : t("reviews.review_renter_cta")

  const handleOpen = (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setOpen(true)
  }

  const handleClose = () => setOpen(false)

  const handleSubmitted = () => {
    setOpen(false)
    // Refresh server-rendered data (e.g. this button's own visibility on
    // the bookings list) in addition to any caller-supplied refetch.
    router.refresh()
    onSubmitted?.()
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={
          variant === "card"
            ? "flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            : "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        }
      >
        <Star className={variant === "card" ? "h-4 w-4" : "h-3.5 w-3.5"} />
        {t("reviews.leave_review_cta")}
      </button>

      <Modal open={open} onClose={handleClose} title={modalTitle}>
        <ReviewForm
          bookingId={bookingId}
          targetRole={targetRole}
          context={context}
          onSubmitted={handleSubmitted}
        />
      </Modal>
    </>
  )
}
