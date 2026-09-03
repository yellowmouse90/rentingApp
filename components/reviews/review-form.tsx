"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"
import { getSubRatingKeys, SUGGESTED_TAGS, MAX_COMMENT_LENGTH } from "@/lib/reviews/rules"
import type { ReviewContext, ReviewTargetRole } from "@/lib/types"
import { StarRating } from "./star-rating"

interface ReviewFormProps {
  bookingId: string
  targetRole: ReviewTargetRole
  context: ReviewContext
  onSubmitted: () => void
}

// Spec sez. 6: "1 tap per le stelle overall, chip opzionali per i tag,
// commento libero opzionale, mai un form lungo obbligatorio" - only the
// overall rating blocks submission, sub-ratings sit behind a details
// toggle so the default path is a single tap.
export function ReviewForm({ bookingId, targetRole, context, onSubmitted }: ReviewFormProps) {
  const { t } = useLanguage()
  const [overall, setOverall] = useState(0)
  const [subRatings, setSubRatings] = useState<Record<string, number>>({})
  const [tags, setTags] = useState<string[]>([])
  const [comment, setComment] = useState("")
  const [showDetails, setShowDetails] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const subKeys = getSubRatingKeys(targetRole, context)
  const suggestedTags = SUGGESTED_TAGS[targetRole]

  const toggleTag = (tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((existing) => existing !== tag) : [...prev, tag]))
  }

  const handleSubmit = async () => {
    if (overall < 1 || isSubmitting) return
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/bookings/${bookingId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_role: targetRole,
          overall_rating: overall,
          sub_ratings: subRatings,
          tags,
          comment: comment.trim() || undefined,
        }),
      })

      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || t("reviews.error_generic"))

      onSubmitted()
    } catch (err) {
      setError(err instanceof Error ? err.message : t("reviews.error_generic"))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h2 className="text-lg font-semibold text-foreground">
        {targetRole === "lender" ? t("reviews.review_lender_cta") : t("reviews.review_renter_cta")}
      </h2>

      {error && (
        <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      <div className="mt-4">
        <p className="text-sm font-medium text-foreground">{t("reviews.overall_rating_label")}</p>
        <div className="mt-2">
          <StarRating value={overall} onChange={setOverall} size="lg" />
        </div>
      </div>

      {suggestedTags.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-medium text-foreground">{t("reviews.tags_label")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestedTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  tags.includes(tag)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowDetails((prev) => !prev)}
        className="mt-4 text-sm font-medium text-primary hover:underline"
      >
        {showDetails ? t("reviews.details_toggle_hide") : t("reviews.details_toggle_show")}
      </button>

      {showDetails && (
        <div className="mt-3 space-y-3">
          {subKeys.map((key) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">{t(`reviews.sub_rating.${key}`)}</span>
              <StarRating
                value={subRatings[key] || 0}
                onChange={(next) => setSubRatings((prev) => ({ ...prev, [key]: next }))}
                size="sm"
              />
            </div>
          ))}
        </div>
      )}

      <textarea
        value={comment}
        onChange={(event) => setComment(event.target.value.slice(0, MAX_COMMENT_LENGTH))}
        placeholder={t("reviews.comment_placeholder")}
        rows={3}
        className="mt-4 w-full rounded-lg border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground"
      />

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isSubmitting || overall < 1}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {isSubmitting ? t("reviews.submitting") : t("reviews.submit")}
      </button>
    </div>
  )
}
