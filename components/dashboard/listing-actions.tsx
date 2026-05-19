"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useLanguage } from "@/lib/i18n/language-context"
import { Loader2, Pencil, Trash2 } from "lucide-react"

interface ListingActionsProps {
  listingId: string
  isActive: boolean
}

export function ListingActions({ listingId, isActive }: ListingActionsProps) {
  const { t } = useLanguage()
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    if (!isActive || isDeleting) return

    const confirmed = window.confirm(
      t("listing.actions.confirm_archive")
    )

    if (!confirmed) return

    setError(null)
    setIsDeleting(true)

    try {
      const response = await fetch(`/api/listings/${listingId}`, { method: "DELETE" })

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error || t("listing.actions.archive_error"))
      }

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t("listing.actions.archive_error"))
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {isActive ? (
          <Link
            href={`/listings/${listingId}/edit`}
            className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Pencil className="h-4 w-4" />
            {t("common.edit")}
          </Link>
        ) : null}

        <Link
          href={`/listings/${listingId}`}
          className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          {t("listing.actions.details")}
        </Link>

        {isActive ? (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-3 py-1.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {t("listing.actions.archive")}
          </button>
        ) : (
          <span className="inline-flex items-center rounded-md bg-muted px-3 py-1.5 text-sm text-muted-foreground">
            {t("listing.actions.already_archived")}
          </span>
        )}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
