"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export function useUnreadMessageCount(userId?: string) {
  const [count, setCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Realtime postgres_changes events are not scoped by RLS on the wire in this project (see
  // lib/chat/realtime.ts's useRealtimeConversations) - without this guard every message sent by
  // any user on the platform, sender/content included, is delivered to every connected client's
  // browser. Kept fresh independently of fetchCount's own render cycle.
  const conversationIdsRef = useRef<string[]>([])

  const fetchConversationIds = useCallback(async () => {
    if (!userId) return
    try {
      const supabase = createClient()
      const { data } = await supabase
        .schema("interactions_domain")
        .from("conversations")
        .select("id")
        .or(`participant_one.eq.${userId},participant_two.eq.${userId}`)
      conversationIdsRef.current = (data || []).map((c: { id: string }) => c.id)
    } catch (err) {
      console.error("Unread count: impossibile recuperare gli id delle conversazioni", err)
    }
  }, [userId])

  const fetchCount = useCallback(async () => {
    if (!userId) return

    try {
      setIsLoading(true)
      const response = await fetch("/api/chat/unread-count")
      if (!response.ok) {
        throw new Error("Failed to fetch unread count")
      }

      const data = await response.json()
      setCount(data.unread_count ?? 0)
      setError(null)
    } catch (err) {
      setError("Impossibile recuperare le notifiche")
      console.error("Unread count fetch error:", err)
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (!userId) return
    fetchCount()
    fetchConversationIds()
    // Realtime keeps this in sync; poll only as a fallback safety net in
    // case a subscription silently drops, and refresh on tab refocus.
    const interval = window.setInterval(() => {
      fetchCount()
      fetchConversationIds()
    }, 60000)
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchCount()
        fetchConversationIds()
      }
    }
    document.addEventListener("visibilitychange", handleVisibility)
    window.addEventListener("focus", handleVisibility)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", handleVisibility)
      window.removeEventListener("focus", handleVisibility)
    }
  }, [userId, fetchCount, fetchConversationIds])

  useEffect(() => {
    if (!userId) return

    const supabase = createClient()
    const channelName = `unread-messages-${userId}-${Math.random().toString(36).slice(2)}`
    const channel = supabase.channel(channelName)

    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "interactions_domain",
        table: "messages",
      },
      (payload) => {
        const message = payload.new as { conversation_id?: string } | undefined
        // See the guard comment above conversationIdsRef: this table can't be filtered
        // server-side (no participant column), so every INSERT reaches every client regardless
        // of RLS - only react to messages in a conversation this user is actually part of. A
        // brand-new conversation (created after the last refresh) is still caught by the 60s
        // poll / visibility refresh above, or by the next chatUnreadCountRefresh event.
        if (!message?.conversation_id) return
        if (!conversationIdsRef.current.includes(message.conversation_id)) return
        fetchCount()
      }
    )

    channel.subscribe((status) => {
      if (status === "CHANNEL_ERROR") {
        console.error("Unread count realtime channel error")
      }
    })

    const handleRefresh = () => {
      fetchCount()
      fetchConversationIds()
    }
    window.addEventListener("chatUnreadCountRefresh", handleRefresh)

    return () => {
      window.removeEventListener("chatUnreadCountRefresh", handleRefresh)
      supabase.removeChannel(channel)
    }
  }, [userId, fetchCount, fetchConversationIds])

  return { count, isLoading, error, refresh: fetchCount }
}
