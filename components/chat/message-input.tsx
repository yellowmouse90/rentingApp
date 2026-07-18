"use client"

import { useState, useRef, useEffect } from "react"
import { Send, Loader2 } from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"
import { MAX_MESSAGE_LENGTH } from "@/lib/types/chat"

interface MessageInputProps {
  onSendMessage: (content: string) => Promise<void>
  disabled?: boolean
  placeholder?: string
}

export function MessageInput({
  onSendMessage,
  disabled = false,
  placeholder,
}: MessageInputProps) {
  const { t } = useLanguage()
  const [message, setMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-expand textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [message])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!message.trim() || isLoading || disabled) return

    try {
      setIsLoading(true)
      await onSendMessage(message.trim())
      setMessage("")
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto"
      }
    } catch (error) {
      console.error("Failed to send message:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border-t border-border bg-card p-4 sm:p-6">
      <div className="flex gap-3">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={placeholder || t("chat.message_placeholder")}
          disabled={disabled || isLoading}
          maxLength={MAX_MESSAGE_LENGTH}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.ctrlKey) {
              handleSubmit(e as any)
            }
          }}
          className="flex-1 min-h-10 max-h-30 resize-none rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground placeholder-muted-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
          rows={1}
        />
        <button
          type="submit"
          disabled={disabled || isLoading || !message.trim()}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={t("chat.send_message")}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>
      <p className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>{t("chat.ctrl_enter_hint")}</span>
        {message.length > MAX_MESSAGE_LENGTH * 0.8 && (
          <span>
            {message.length}/{MAX_MESSAGE_LENGTH}
          </span>
        )}
      </p>
    </form>
  )
}
