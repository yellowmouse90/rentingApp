"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/i18n/language-context"

export function DeleteAccountSection() {
  const { t } = useLanguage()
  const router = useRouter()
  const supabase = createClient()
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    if (isDeleting) return

    const confirmed = window.confirm(t("account_deletion.confirm_prompt"))
    if (!confirmed) return

    setError(null)
    setIsDeleting(true)

    try {
      const response = await fetch("/api/account", { method: "DELETE" })

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error || t("account_deletion.error_generic"))
      }

      // The row backing this session no longer exists server-side; clear the local
      // session/cookies before leaving so no stale client state points at a deleted account.
      await supabase.auth.signOut()
      router.push("/")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t("account_deletion.error_generic"))
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("account_deletion.warning")}</p>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <button
        type="button"
        onClick={handleDelete}
        disabled={isDeleting}
        className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        {isDeleting ? t("account_deletion.deleting") : t("account_deletion.button")}
      </button>
    </div>
  )
}
