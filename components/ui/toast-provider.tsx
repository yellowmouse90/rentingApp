"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { useLanguage } from "@/lib/i18n/language-context"

type ToastVariant = "error" | "success" | "info"

interface ToastItem {
  id: number
  message: string
  variant: ToastVariant
}

type Listener = (message: string, variant: ToastVariant) => void

let listeners: Listener[] = []

/** Fire a toast from anywhere (server-rendered pages, effects, non-component code). */
export function emitToast(message: string, variant: ToastVariant = "error") {
  listeners.forEach((listener) => listener(message, variant))
}

const ToastContext = createContext<Listener | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage()
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const idRef = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback<Listener>(
    (message, variant) => {
      const id = ++idRef.current
      setToasts((prev) => [...prev, { id, message, variant }])
      setTimeout(() => dismiss(id), 6000)
    },
    [dismiss]
  )

  useEffect(() => {
    listeners.push(push)
    return () => {
      listeners = listeners.filter((l) => l !== push)
    }
  }, [push])

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="alert"
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border p-3 text-sm shadow-lg ${
              toast.variant === "error"
                ? "border-destructive/40 bg-destructive text-destructive-foreground"
                : toast.variant === "success"
                  ? "border-accent/40 bg-accent text-accent-foreground"
                  : "border-border bg-card text-foreground"
            }`}
          >
            <span className="flex-1">{toast.message}</span>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="text-xs font-medium opacity-70 hover:opacity-100"
              aria-label={t("common.close_notification")}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctxPush = useContext(ToastContext)
  const push = ctxPush ?? emitToast
  return {
    error: (message: string) => push(message, "error"),
    success: (message: string) => push(message, "success"),
    info: (message: string) => push(message, "info"),
  }
}
