"use client"

import { Conversation, Profile } from "@/lib/types"
import { formatDistanceToNow } from "date-fns"
import { it, enUS } from "date-fns/locale"
import { MessageCircle, Package } from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"

interface ConversationListProps {
  conversations: (Conversation & {
    unread_count?: number
    other_participant_details?: Profile
  })[]
  selectedConversationId?: string
  onSelectConversation: (conversationId: string) => void
  isLoading?: boolean
}

export function ConversationList({
  conversations,
  selectedConversationId,
  onSelectConversation,
  isLoading = false,
}: ConversationListProps) {
  const { t, language } = useLanguage()
  const dateLocale = language === "en" ? enUS : it

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">{t("chat.loading")}</p>
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center space-y-3 p-6 text-center">
        <div className="rounded-full bg-muted p-3">
          <MessageCircle className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium text-foreground">{t("chat.no_conversation")}</p>
          <p className="text-sm text-muted-foreground">
            {t("chat.start_new_from_order")}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2 overflow-y-auto">
      {conversations.map((conversation) => {
        // See the matching note in chat-thread.tsx: a present-but-nameless
        // other_participant_details means a soft-deleted account, same as the field being
        // absent entirely (legacy hard-delete) - both read the same translated label.
        const otherUserDisplayName =
          conversation.other_participant_details?.display_name || t("chat.deleted_user")
        const orderItems = conversation.rental_order?.items || []
        const countItem = orderItems.length
        const firstListing = orderItems[0]?.listing as
          | { title?: string; image_url?: string | null }
          | undefined
        const orderTitle = firstListing?.title || t("chat.order_fallback")
        const orderImageUrl = firstListing?.image_url || null
        return (
          <button
            key={conversation.id}
            onClick={() => onSelectConversation(conversation.id)}
            className={`w-full rounded-lg border transition-colors text-left p-3 sm:p-4 ${
              selectedConversationId === conversation.id
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-muted/50"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="shrink-0">
                {orderImageUrl ? (
                  <img
                    src={orderImageUrl}
                    alt={orderTitle}
                    className="h-12 w-12 rounded-md object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted">
                    <Package className="h-5 w-5 text-muted-foreground/50" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground truncate">
                  {orderTitle}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {t("chat.with")} {otherUserDisplayName}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {countItem} {t("chat.items_count")} · {conversation.last_message?.content || t("chat.no_messages_short")}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs text-muted-foreground">
                  {conversation.last_message_at
                    ? formatDistanceToNow(
                        new Date(conversation.last_message_at),
                        {
                          addSuffix: false,
                          locale: dateLocale,
                        }
                      )
                    : t("chat.today")}
                </p>
                {(conversation.unread_count ?? 0) > 0 && (
                  <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {Math.min(conversation.unread_count ?? 0, 9)}+
                  </span>
                )}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
