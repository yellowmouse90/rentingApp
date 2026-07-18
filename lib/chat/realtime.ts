"use client"

import { useEffect, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { RealtimeChannel } from "@supabase/supabase-js"

export function useRealtimeMessages(
  conversationId: string,
  onMessageReceived: (message: any) => void,
  onMessageDeleted?: (messageId: string) => void
) {
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    if (!conversationId) return

    const supabase = createClient()

    // Create realtime channel for this conversation
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "interactions_domain",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          onMessageReceived(payload.new)
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "interactions_domain",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          onMessageReceived(payload.new)
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "interactions_domain",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          onMessageDeleted?.(payload.old.id)
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.error("Channel error in realtime subscription")
        }
      })

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [conversationId, onMessageReceived, onMessageDeleted])
}

export function useRealtimeConversations(
  userId: string,
  conversationIds: string[],
  onConversationUpdated: (conversation: any) => void,
  onMessageReceived?: (message: any) => void
) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  // Kept fresh without re-subscribing the channel on every conversation
  // list change (the effect only depends on userId).
  const conversationIdsRef = useRef<string[]>(conversationIds)
  conversationIdsRef.current = conversationIds

  useEffect(() => {
    if (!userId) return

    const supabase = createClient()

    // Subscribe to conversation changes
    const channel = supabase
      .channel(`conversations:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "interactions_domain",
          table: "conversations",
          filter: `or=(participant_one.eq.${userId},participant_two.eq.${userId})`,
        },
        (payload) => {
          onConversationUpdated(payload.new || payload.old)
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "interactions_domain",
          table: "messages",
        },
        (payload) => {
          const message = payload.new as any
          // This channel can't be filtered server-side to just this user's
          // rows (messages has no participant column), so every client
          // receives every INSERT event regardless of Realtime RLS. Guard
          // client-side against reacting to messages from conversations
          // this user isn't part of.
          if (!message?.conversation_id) return
          if (!conversationIdsRef.current.includes(message.conversation_id)) return
          onMessageReceived?.(message)
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.error("Channel error in realtime subscription")
        }
      })

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [userId, onConversationUpdated, onMessageReceived])
}
