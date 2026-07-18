"use client"

import { useEffect, useState, useCallback } from "react"
import { useAuth } from "@/lib/auth/context"
import { useLanguage } from "@/lib/i18n/language-context"
import { useRealtimeConversations } from "@/lib/chat/realtime"
import { Conversation } from "@/lib/types"
import { ConversationList } from "./conversation-list"
import { ChatThread } from "./chat-thread"
import { Loader2 } from "lucide-react"

interface ChatPageProps {
  initialConversationId?: string
}

export function ChatPage({ initialConversationId }: ChatPageProps) {
  const { user, isLoading: authLoading } = useAuth()
  const { t } = useLanguage()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(initialConversationId || null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isMobileListVisible, setIsMobileListVisible] = useState(true)

  // Fetch conversations
  useEffect(() => {
    if (!user?.id || authLoading) return

    const fetchConversations = async () => {
      try {
        setIsLoading(true)
        const response = await fetch(
          `/api/chat/conversations?user_id=${user.id}`
        )

        if (!response.ok) throw new Error("Failed to fetch conversations")

        const data = await response.json()
        setConversations(data.conversations || [])
        setError(null)

        // Select first conversation if none selected
        if (
          !selectedConversationId &&
          data.conversations &&
          data.conversations.length > 0
        ) {
          setSelectedConversationId(data.conversations[0].id)
        }
      } catch (err) {
        console.error("Conversations fetch error:", err)
        setError(t("chat.load_conversations_error"))
      } finally {
        setIsLoading(false)
      }
    }

    fetchConversations()
  }, [user?.id, authLoading])

  // Subscribe to realtime conversation updates
  useRealtimeConversations(
    user?.id || "",
    useCallback(
      (updatedConversation: Conversation) => {
        setConversations((prev) => {
          const existing = prev.find((c) => c.id === updatedConversation.id)
          if (existing) {
            // Update existing conversation
            return prev.map((c) =>
              c.id === updatedConversation.id ? updatedConversation : c
            )
          }
          // Add new conversation
          return [updatedConversation, ...prev]
        })
      },
      []
    ),
    useCallback(
      (newMessage: any) => {
        // Update last_message_at for relevant conversation
        setConversations((prev) =>
          prev.map((c) =>
            c.id === newMessage.conversation_id
              ? { ...c, last_message_at: newMessage.created_at }
              : c
          )
        )
      },
      []
    )
  )

  const selectedConversation = conversations.find(
    (c) => c.id === selectedConversationId
  )

  if (authLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">
          {t("chat.login_required")}
        </p>
      </div>
    )
  }

  return (
    <div className="grid h-full grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Conversation List - Hidden on mobile when thread is selected */}
      <div
        className={`hidden lg:flex flex-col rounded-xl border border-border bg-card ${
          !isMobileListVisible && selectedConversationId
            ? "hidden"
            : "flex"
        } lg:col-span-1`}
      >
        <div className="border-b border-border px-4 py-3 sm:px-6 sm:py-4">
          <h2 className="font-semibold text-foreground">{t("chat.title")}</h2>
        </div>

        <div className="flex-1 overflow-hidden p-4">
          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <ConversationList
            conversations={conversations}
            selectedConversationId={selectedConversationId || undefined}
            onSelectConversation={setSelectedConversationId}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Chat Thread - Full width on mobile */}
      <div className="lg:col-span-2">
        {selectedConversation && user ? (
          <ChatThread
            conversation={selectedConversation}
            onBack={() => setIsMobileListVisible(true)}
          />
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl border border-border bg-card">
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">
                {conversations.length === 0
                  ? t("chat.no_conversation")
                  : t("chat.select_conversation")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {conversations.length === 0
                  ? t("chat.start_new_from_order")
                  : t("chat.click_to_start")}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Conversation List */}
      <div className="fixed inset-0 top-16 z-40 flex flex-col lg:hidden bg-background">
        {selectedConversationId && (
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="font-semibold text-foreground">{t("chat.title")}</h2>
            <button
              onClick={() => setIsMobileListVisible(false)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {t("chat.close")}
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-4">
          <ConversationList
            conversations={conversations}
            selectedConversationId={selectedConversationId || undefined}
            onSelectConversation={(id) => {
              setSelectedConversationId(id)
              setIsMobileListVisible(false)
            }}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  )
}
