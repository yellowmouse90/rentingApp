"use client"

import { useCallback, useEffect, useState } from "react"
import { format } from "date-fns"
import { enUS, it } from "date-fns/locale"
import { useLanguage } from "@/lib/i18n/language-context"
import type { ReviewContext, ReviewTargetRole } from "@/lib/types"
import { StarRating } from "./star-rating"

interface ReviewAuthor {
  id: string
  display_name: string | null
  avatar_url: string | null
}

interface ReviewRow {
  id: string
  overall_rating: number
  sub_ratings: Record<string, number>
  comment: string | null
  tags: string[]
  created_at: string
  visible_at: string | null
  author: ReviewAuthor | null
}

interface RatingSummary {
  user_id: string
  role: ReviewTargetRole
  context: ReviewContext
  average_rating: number
  review_count: number
  tag_frequency: Record<string, number>
}

interface ReviewsSectionProps {
  userId: string
  role: ReviewTargetRole
  context: ReviewContext
}

// Spec sez. 6: rating aggregato in evidenza, sotto-voci dietro "vedi
// dettagli". Phase 1 only ever calls this with role='lender',
// context='ferramenta' (the public-facing combination) from
// app/users/[id]/page.tsx.
export function ReviewsSection({ userId, role, context }: ReviewsSectionProps) {
  const { t, language } = useLanguage()
  const dateLocale = language === "it" ? it : enUS
  const [summary, setSummary] = useState<RatingSummary | null>(null)
  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [showTagDetails, setShowTagDetails] = useState(false)

  const loadPage = useCallback(
    async (nextPage: number) => {
      setIsLoading(true)
      try {
        const response = await fetch(
          `/api/users/${userId}/reviews?role=${role}&context=${context}&page=${nextPage}`
        )
        if (!response.ok) return
        const data = await response.json()
        setReviews((prev) => (nextPage === 1 ? data.reviews : [...prev, ...data.reviews]))
        setTotal(data.total)
        setPage(nextPage)
      } finally {
        setIsLoading(false)
      }
    },
    [userId, role, context]
  )

  useEffect(() => {
    loadPage(1)
    fetch(`/api/users/${userId}/rating-summary`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const match = (data?.summaries as RatingSummary[] | undefined)?.find(
          (item) => item.role === role && item.context === context
        )
        if (match) setSummary(match)
      })
      .catch(() => {})
  }, [loadPage, userId, role, context])

  const tagEntries = Object.entries(summary?.tag_frequency ?? {}).sort((a, b) => b[1] - a[1])

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{t("reviews.rating_summary_title")}</h2>
        {tagEntries.length > 0 && (
          <button
            type="button"
            onClick={() => setShowTagDetails((prev) => !prev)}
            className="text-sm font-medium text-primary hover:underline"
          >
            {showTagDetails ? t("reviews.details_toggle_hide") : t("reviews.details_toggle_show")}
          </button>
        )}
      </div>

      {showTagDetails && tagEntries.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {tagEntries.map(([tag, count]) => (
            <span
              key={tag}
              className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground"
            >
              {tag} · {count}
            </span>
          ))}
        </div>
      )}

      {!isLoading && reviews.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">{t("reviews.no_reviews_yet")}</p>
      )}

      <div className="mt-4 space-y-4">
        {reviews.map((review) => (
          <div key={review.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {review.author?.avatar_url ? (
                  <img
                    src={review.author.avatar_url}
                    alt={review.author.display_name || ""}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                    {(review.author?.display_name || "U").slice(0, 2).toUpperCase()}
                  </div>
                )}
                <span className="text-sm font-medium text-foreground">
                  {review.author?.display_name || "Utente"}
                </span>
              </div>
              <StarRating value={review.overall_rating} size="sm" />
            </div>
            {review.comment && <p className="mt-2 text-sm text-muted-foreground">{review.comment}</p>}
            {review.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {review.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              {format(new Date(review.visible_at || review.created_at), "d MMM yyyy", { locale: dateLocale })}
            </p>
          </div>
        ))}
      </div>

      {reviews.length < total && (
        <button
          type="button"
          onClick={() => loadPage(page + 1)}
          disabled={isLoading}
          className="mt-4 w-full rounded-lg border border-border py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          {t("reviews.load_more")}
        </button>
      )}
    </div>
  )
}
