"use client"

import { useEffect, useState, useCallback } from "react"
import { useAuth } from "@/lib/auth/context"
import { useLanguage } from "@/lib/i18n/language-context"
import { useRealtimeMessages } from "@/lib/chat/realtime"
import { Conversation, Profile, Message } from "@/lib/types"
import { MessageList } from "./message-list"
import { MessageInput } from "./message-input"
import { ChevronLeft, Loader2 } from "lucide-react"
import { ChatMessage } from "@/lib/types/chat"

interface ChatThreadProps {
  conversation: Conversation & {
    other_participant_details?: Profile
  }
  onBack?: () => void
  isDarkMode?: boolean
}

const PAGE_SIZE = 50
// Realtime should deliver updates instantly; this interval is only a
// fallback safety net in case a subscription silently drops.
const FALLBACK_POLL_INTERVAL_MS = 30000

function mergeMessages(existing: Message[], incoming: Message[]): Message[] {
  if (incoming.length === 0) return existing
  const byId = new Map(existing.map((m) => [m.id, m]))
  incoming.forEach((m) => byId.set(m.id, m))
  return Array.from(byId.values()).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
}

export function ChatThread({
  conversation,
  onBack,
  isDarkMode,
}: ChatThreadProps) {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMoreMessages, setHasMoreMessages] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const otherUser =
    conversation.other_participant_details || ({
      display_name: t("chat.default_user"),
      avatar_url: null,
      email: null,
    } as unknown as Profile)

  // Fetches the most recent page of messages. Used for the initial load and
  // as a fallback refresh; merges into (rather than replaces) local state so
  // older messages loaded via loadOlderMessages aren't dropped.
  const fetchMessages = useCallback(
    async (showLoading = false) => {
      if (!conversation.id) return

      try {
        if (showLoading) {
          setIsLoading(true)
        }

        const response = await fetch(
          `/api/chat/messages?conversation_id=${conversation.id}&limit=${PAGE_SIZE}`
        )

        if (!response.ok) throw new Error("Failed to fetch messages")

        const data = await response.json()
        setMessages((prev) => mergeMessages(prev, data.messages || []))
        setHasMoreMessages(Boolean(data.hasMore))
        setError(null)
      } catch (err) {
        setError(t("chat.load_messages_error"))
        console.error("Messages fetch error:", err)
      } finally {
        if (showLoading) {
          setIsLoading(false)
        }
      }
    },
    [conversation.id]
  )

  const loadOlderMessages = useCallback(async () => {
    if (!conversation.id || isLoadingMore || !hasMoreMessages) return

    const oldest = messages[0]
    if (!oldest) return

    try {
      setIsLoadingMore(true)
      const response = await fetch(
        `/api/chat/messages?conversation_id=${conversation.id}&limit=${PAGE_SIZE}&before=${encodeURIComponent(
          oldest.created_at
        )}`
      )

      if (!response.ok) throw new Error("Failed to fetch older messages")

      const data = await response.json()
      setMessages((prev) => mergeMessages(prev, data.messages || []))
      setHasMoreMessages(Boolean(data.hasMore))
    } catch (err) {
      console.error("Failed to load older messages:", err)
    } finally {
      setIsLoadingMore(false)
    }
  }, [conversation.id, isLoadingMore, hasMoreMessages, messages])

  useEffect(() => {
    if (!conversation.id) return

    fetchMessages(true)
    const interval = window.setInterval(
      () => fetchMessages(false),
      FALLBACK_POLL_INTERVAL_MS
    )
    const handleVisibility = () => {
      if (document.visibilityState === "visible") fetchMessages(false)
    }
    document.addEventListener("visibilitychange", handleVisibility)
    window.addEventListener("focus", handleVisibility)

    return () => {
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", handleVisibility)
      window.removeEventListener("focus", handleVisibility)
    }
  }, [conversation.id, fetchMessages])

  // Subscribe to realtime messages
  useRealtimeMessages(
    conversation.id || "",
    useCallback(
      (newMessage: Message) => {
        setMessages((prev) => {
          if (prev.find((m) => m.id === newMessage.id)) {
            return prev
          }
          return [...prev, newMessage]
        })
      },
      []
    ),
    useCallback((deletedMessageId: string) => {
      setMessages((prev) => prev.filter((m) => m.id !== deletedMessageId))
    }, [])
  )

  // Mark messages as read
  const handleMarkAsRead = useCallback(
    async (messageIds: string[]) => {
      if (messageIds.length === 0) return

      try {
        const response = await fetch("/api/chat/messages/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: conversation.id,
            messageIds,
          }),
        })

        if (response.ok) {
          window.dispatchEvent(new Event("chatUnreadCountRefresh"))
        }
      } catch (err) {
        console.error("Failed to mark messages as read:", err)
      }
    },
    [conversation.id]
  )

  // Send message
  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!user?.id || !content.trim()) return

      try {
        setIsSending(true)
        const response = await fetch("/api/chat/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: conversation.id,
            content: content.trim(),
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data?.error || "Failed to send message")
        }

        setMessages((prev) => [...prev, data.message])
        setError(null)
      } catch (err) {
        console.error("Failed to send message:", err)
        setError(err instanceof Error ? err.message : t("chat.send_message_error"))
      } finally {
        setIsSending(false)
      }
    },
    [conversation.id, user?.id, t]
  )

  if (isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-3 text-sm text-muted-foreground">
          {t("chat.loading_conversation")}
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="rounded p-1 hover:bg-muted lg:hidden"
              aria-label={t("chat.back")}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          <div>
            <p className="font-semibold text-foreground">
              {otherUser.display_name}
            </p>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Messages */}
      <MessageList
        messages={(messages as ChatMessage[])}
        currentUserId={user?.id || ""}
        otherUser={otherUser}
        onMessagesVisible={handleMarkAsRead}
        hasMore={hasMoreMessages}
        isLoadingMore={isLoadingMore}
        onLoadMore={loadOlderMessages}
      />

      {/* Input */}
      <MessageInput
        onSendMessage={handleSendMessage}
        disabled={isSending}
        placeholder={t("chat.message_placeholder")}
      />
    </div>
  )
}
