"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export function useUnreadMessageCount(userId?: string) {
  const [count, setCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    // Realtime keeps this in sync; poll only as a fallback safety net in
    // case a subscription silently drops, and refresh on tab refocus.
    const interval = window.setInterval(fetchCount, 60000)
    const handleVisibility = () => {
      if (document.visibilityState === "visible") fetchCount()
    }
    document.addEventListener("visibilitychange", handleVisibility)
    window.addEventListener("focus", handleVisibility)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", handleVisibility)
      window.removeEventListener("focus", handleVisibility)
    }
  }, [userId, fetchCount])

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
      () => {
        fetchCount()
      }
    )

    channel.subscribe((status) => {
      if (status === "CHANNEL_ERROR") {
        console.error("Unread count realtime channel error")
      }
    })

    const handleRefresh = () => fetchCount()
    window.addEventListener("chatUnreadCountRefresh", handleRefresh)

    return () => {
      window.removeEventListener("chatUnreadCountRefresh", handleRefresh)
      supabase.removeChannel(channel)
    }
  }, [userId, fetchCount])

  return { count, isLoading, error, refresh: fetchCount }
}
