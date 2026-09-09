"use client"

import { useState } from "react"
import { useLanguage } from "@/lib/i18n/language-context"

interface ProfileEditFormProps {
  initialDisplayName: string
  initialBio: string
  initialPhone: string
}

export function ProfileEditForm({ initialDisplayName, initialBio, initialPhone }: ProfileEditFormProps) {
  const { t } = useLanguage()
  const [displayName, setDisplayName] = useState(initialDisplayName)
  const [bio, setBio] = useState(initialBio)
  const [phone, setPhone] = useState(initialPhone)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!displayName.trim()) {
      setMessage({ type: "error", text: t("profile_edit.display_name_required") })
      return
    }

    setIsSaving(true)
    setMessage(null)

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, bio, phone }),
      })
      if (!response.ok) throw new Error("Failed to save profile")
      setMessage({ type: "success", text: t("profile_edit.save_success") })
    } catch (err) {
      console.error("Profile save error:", err)
      setMessage({ type: "error", text: t("profile_edit.save_error") })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {message && (
        <p className={`text-sm ${message.type === "success" ? "text-green-600" : "text-destructive"}`}>
          {message.text}
        </p>
      )}

      <div>
        <label htmlFor="displayName" className="block text-sm font-medium text-foreground">
          {t("profile_edit.display_name_label")}
        </label>
        <input
          id="displayName"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={t("profile_edit.display_name_placeholder")}
          required
          className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="bio" className="block text-sm font-medium text-foreground">
          {t("profile_edit.bio_label")}
        </label>
        <textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder={t("profile_edit.bio_placeholder")}
          rows={4}
          className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-foreground">
          {t("profile_edit.phone_label")}
        </label>
        <input
          id="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={t("profile_edit.phone_placeholder")}
          className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
        />
      </div>

      <button
        type="submit"
        disabled={isSaving}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
      >
        {isSaving ? t("common.loading") : t("common.save")}
      </button>
    </form>
  )
}
