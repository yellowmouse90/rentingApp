"use client"

import { useEffect } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}

// Minimal dependency-free dialog (no Radix/Headless UI in this repo) -
// portalled to document.body so it always stacks above whatever card/link
// it's opened from, closes on Escape or backdrop click, and locks page
// scroll while open.
export function Modal({ open, onClose, title, children }: ModalProps) {
  const { t } = useLanguage()

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }

    document.addEventListener("keydown", handleKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!open || typeof document === "undefined") return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-card shadow-xl"
      >
        <div className="flex items-center justify-between gap-4 border-b border-border p-4">
          {title && <h2 className="text-base font-semibold text-foreground">{title}</h2>}
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="ml-auto shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>,
    document.body
  )
}
