"use client"

import { useCallback, useEffect, useRef } from "react"
import { ChatMessage } from "@/lib/types/chat"
import { Profile } from "@/lib/types"
import { formatDistanceToNow } from "date-fns"
import { it } from "date-fns/locale"

interface MessageListProps {
  messages: ChatMessage[]
  currentUserId: string
  otherUser: Profile
  onMessagesVisible?: (messageIds: string[]) => void
}

export function MessageList({
  messages,
  currentUserId,
  otherUser,
  onMessagesVisible,
}: MessageListProps) {
  const endOfMessagesRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const hasLoadedRef = useRef(false)
  const isAtBottomRef = useRef(true)

  const scrollToBottom = (behavior: ScrollBehavior = "auto") => {
    endOfMessagesRef.current?.scrollIntoView({ behavior })
  }

  const handleScroll = useCallback(() => {
    const element = containerRef.current
    if (!element) return

    const distanceFromBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight
    isAtBottomRef.current = distanceFromBottom < 32
  }, [])

  useEffect(() => {
    if (!containerRef.current) return

    handleScroll()
  }, [handleScroll])

  useEffect(() => {
    if (!containerRef.current) return

    // if (!hasLoadedRef.current || isAtBottomRef.current) {
    //   scrollToBottom("auto")
    // }

    hasLoadedRef.current = true
  }, [messages])

  // Mark visible messages as read
  useEffect(() => {
    if (!containerRef.current || !onMessagesVisible) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleIds = entries
          .filter((entry) => entry.isIntersecting)
          .map((entry) => entry.target.id)

        if (visibleIds.length > 0) {
          onMessagesVisible(visibleIds)
        }
      },
      { threshold: 0.5 }
    )

    const messageElements = containerRef.current.querySelectorAll("[data-message-id]")
    messageElements.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [onMessagesVisible])

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto space-y-4 p-4 sm:p-6"
    >
      {messages.length === 0 ? (
        <div className="flex h-full items-center justify-center text-center">
          <div>
            <p className="text-sm text-muted-foreground">
              Non ci sono ancora messaggi
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Iniza la conversazione con {otherUser.display_name || "questo utente"}
            </p>
          </div>
        </div>
      ) : (
        messages.map((message) => {
          const isCurrentUser = message.sender_id === currentUserId
          const sender = isCurrentUser
            ? { display_name: "Tu" }
            : otherUser

          return (
            <div
              key={message.id}
              id={message.id}
              data-message-id={message.id}
              className={`flex gap-3 ${
                isCurrentUser ? "flex-row-reverse" : "flex-row"
              }`}
            >
              {/* Avatar */}
              <div
                className={`h-8 w-8 shrink-0 rounded-full bg-gradient-to-br ${
                  isCurrentUser
                    ? "from-blue-400 to-blue-600"
                    : "from-gray-400 to-gray-600"
                } flex items-center justify-center text-xs font-semibold text-white`}
              >
                {sender.display_name?.[0] || "?"}
              </div>

              {/* Message bubble */}
              <div
                className={`flex max-w-xs flex-col gap-1 sm:max-w-md lg:max-w-lg ${
                  isCurrentUser ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`rounded-lg px-4 py-2 ${
                    isCurrentUser
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  <p className="break-words text-sm">{message.content}</p>
                </div>
                <div
                  className={`flex items-center gap-2 text-xs ${
                    isCurrentUser
                      ? "flex-row-reverse"
                      : "flex-row"
                  } text-muted-foreground`}
                >
                  <time>
                    {formatDistanceToNow(new Date(message.created_at), {
                      addSuffix: true,
                      locale: it,
                    })}
                  </time>
                  {isCurrentUser && message.is_read && (
                    <span>✓✓</span>
                  )}
                </div>
              </div>
            </div>
          )
        })
      )}
      <div ref={endOfMessagesRef} />
    </div>
  )
}
