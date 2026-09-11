"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import { useLanguage } from "@/lib/i18n/language-context"
import { createClient } from "@/lib/supabase/client"

interface ProfileEditFormProps {
  initialDisplayName: string
  initialBio: string
  initialPhone: string
  initialAvatarUrl: string | null
}

const MAX_AVATAR_BYTES = 5 * 1024 * 1024
const ALLOWED_AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"]

export function ProfileEditForm({ initialDisplayName, initialBio, initialPhone, initialAvatarUrl }: ProfileEditFormProps) {
  const { t } = useLanguage()
  const [displayName, setDisplayName] = useState(initialDisplayName)
  const [bio, setBio] = useState(initialBio)
  const [phone, setPhone] = useState(initialPhone)
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      setMessage({ type: "error", text: t("profile_edit.avatar_invalid_type") })
      return
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setMessage({ type: "error", text: t("profile_edit.avatar_too_large") })
      return
    }

    setIsUploadingAvatar(true)
    setMessage(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      // Path is prefixed by the uploader's own user id - required by the "avatars" bucket's
      // storage.objects RLS policies (db/migrations/017_create_avatars_bucket.sql), and doubles
      // as a stable, collision-free key per user (overwritten on every new upload rather than
      // accumulating orphaned files, via `upsert`).
      const fileExt = file.name.split(".").pop()
      const filePath = `${user.id}/avatar.${fileExt}`

      const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file, { upsert: true })
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(filePath)
      // Cache-bust: the path is stable (upsert), so without this the browser/CDN would keep
      // showing the previous image under the same URL after a re-upload.
      const bustedUrl = `${publicUrl}?v=${Date.now()}`

      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, bio, phone, avatarUrl: bustedUrl }),
      })
      if (!response.ok) throw new Error("Failed to save avatar")

      setAvatarUrl(bustedUrl)
    } catch (err) {
      console.error("Avatar upload error:", err)
      setMessage({ type: "error", text: t("profile_edit.avatar_upload_error") })
    } finally {
      setIsUploadingAvatar(false)
    }
  }

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

      <div className="flex items-center gap-4">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-muted">
          {avatarUrl ? (
            <Image src={avatarUrl} alt="" fill sizes="80px" className="object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-muted-foreground">
              {displayName.trim().charAt(0).toUpperCase() || "?"}
            </div>
          )}
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_AVATAR_TYPES.join(",")}
            onChange={handleAvatarChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingAvatar}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60"
          >
            {isUploadingAvatar ? t("profile_edit.avatar_uploading") : t("profile_edit.avatar_change")}
          </button>
        </div>
      </div>

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
        <p className="mt-1.5 text-xs text-muted-foreground">{t("profile_edit.phone_privacy_hint")}</p>
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
