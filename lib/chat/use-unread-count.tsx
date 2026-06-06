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
    const interval = window.setInterval(fetchCount, 10000)
    return () => window.clearInterval(interval)
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
