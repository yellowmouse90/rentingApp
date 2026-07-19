"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export function useUnreadNotificationCount(userId?: string) {
  const [count, setCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  const fetchCount = useCallback(async () => {
    if (!userId) return

    try {
      setIsLoading(true)
      const response = await fetch("/api/notifications/unread-count")
      if (!response.ok) {
        throw new Error("Failed to fetch unread notification count")
      }

      const data = await response.json()
      setCount(data.unread_count ?? 0)
    } catch (err) {
      console.error("Unread notification count fetch error:", err)
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
    const channelName = `unread-notifications-${userId}-${Math.random().toString(36).slice(2)}`
    const channel = supabase.channel(channelName)

    // RLS already restricts SELECT to `recipient_id = auth.uid()` at the
    // wire level, so the channel can safely listen unfiltered here (same
    // pattern as lib/chat/use-unread-count.tsx for interactions_domain).
    channel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "notifications_domain", table: "notifications" },
        () => fetchCount()
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "notifications_domain", table: "notifications" },
        () => fetchCount()
      )

    channel.subscribe((status) => {
      if (status === "CHANNEL_ERROR") {
        console.error("Unread notification count realtime channel error")
      }
    })

    const handleRefresh = () => fetchCount()
    window.addEventListener("notificationsUnreadCountRefresh", handleRefresh)

    return () => {
      window.removeEventListener("notificationsUnreadCountRefresh", handleRefresh)
      supabase.removeChannel(channel)
    }
  }, [userId, fetchCount])

  return { count, isLoading, refresh: fetchCount }
}
