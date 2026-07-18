"use client"

import { useState } from "react"
import Link from "next/link"
import { MessageSquare, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useLanguage } from "@/lib/i18n/language-context"

interface InitiateChatProps {
  rentalOrderId: string
  otherUserId: string
  currentUserId: string
  otherUserName: string
  className?: string
  variant?: "button" | "link"
}

export function InitiateChat({
  rentalOrderId,
  otherUserId,
  currentUserId,
  otherUserName,
  className = "",
  variant = "button",
}: InitiateChatProps) {
  const { t } = useLanguage()
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleInitiateChat = async () => {
    try {
      setIsLoading(true)

      // Create or get conversation
      const response = await fetch("/api/chat/start-conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rentalOrderId,
          participantTwoId: otherUserId,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to create conversation")
      }

      const { conversation } = await response.json()

      // Redirect to messages with the conversation selected
      router.push(`/messages?conversation=${conversation.id}`)
    } catch (error) {
      console.error("Failed to initiate chat:", error)
      // Fallback to messages page even if conversation creation fails
      router.push("/messages")
    } finally {
      setIsLoading(false)
    }
  }

  if (variant === "link") {
    return (
      <button
        onClick={handleInitiateChat}
        disabled={isLoading}
        className={`inline-flex items-center justify-center gap-2 rounded-lg border border-border py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <MessageSquare className="h-4 w-4" />
        )}
        {isLoading ? t("chat.loading") : `${t("chat.send_message_to")} ${otherUserName}`}
      </button>
    )
  }

  return (
    <button
      onClick={handleInitiateChat}
      disabled={isLoading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <MessageSquare className="h-4 w-4" />
      )}
      {isLoading ? t("chat.loading") : t("chat.send_message")}
    </button>
  )
}
