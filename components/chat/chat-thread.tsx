"use client"

import { useEffect, useState, useCallback } from "react"
import { useAuth } from "@/lib/auth/context"
import { useRealtimeMessages } from "@/lib/chat/realtime"
import { Conversation, Profile, Message } from "@/lib/types"
import { MessageList } from "./message-list"
import { MessageInput } from "./message-input"
import { ChevronLeft, Loader2 } from "lucide-react"

interface ChatThreadProps {
  conversation: Conversation & {
    other_participant_details?: Profile
  }
  onBack?: () => void
  isDarkMode?: boolean
}

export function ChatThread({
  conversation,
  onBack,
  isDarkMode,
}: ChatThreadProps) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const otherUser =
    conversation.other_participant_details || {
      display_name: "Utente",
      avatar_url: null,
      email: null,
    }

  const fetchMessages = useCallback(
    async (showLoading = false) => {
      if (!conversation.id) return

      try {
        if (showLoading) {
          setIsLoading(true)
        }

        const response = await fetch(
          `/api/chat/messages?conversation_id=${conversation.id}`
        )

        if (!response.ok) throw new Error("Failed to fetch messages")

        const data = await response.json()
        setMessages(data.messages || [])
        setError(null)
      } catch (err) {
        setError("Errore nel caricamento dei messaggi")
        console.error("Messages fetch error:", err)
      } finally {
        if (showLoading) {
          setIsLoading(false)
        }
      }
    },
    [conversation.id]
  )

  useEffect(() => {
    if (!conversation.id) return

    fetchMessages(true)
    const interval = window.setInterval(() => fetchMessages(false), 3000)
    return () => window.clearInterval(interval)
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
            senderId: user.id,
          }),
        })

        if (!response.ok) throw new Error("Failed to send message")

        const data = await response.json()
        setMessages((prev) => [...prev, data.message])
        setError(null)
      } catch (err) {
        console.error("Failed to send message:", err)
        setError("Errore nell'invio del messaggio")
      } finally {
        setIsSending(false)
      }
    },
    [conversation.id, user?.id]
  )

  if (isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-3 text-sm text-muted-foreground">
          Caricamento conversazione...
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
              aria-label="Back"
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
        messages={messages}
        currentUserId={user?.id || ""}
        otherUser={otherUser}
        onMessagesVisible={handleMarkAsRead}
      />

      {/* Input */}
      <MessageInput
        onSendMessage={handleSendMessage}
        disabled={isSending}
        placeholder="Scrivi un messaggio..."
      />
    </div>
  )
}
