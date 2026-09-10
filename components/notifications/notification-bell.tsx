"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Bell } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { it, enUS } from "date-fns/locale"
import { useUnreadNotificationCount } from "@/lib/notifications/use-unread-count"
import { useLanguage } from "@/lib/i18n/language-context"
import { createClient } from "@/lib/supabase/client"

interface NotificationItem {
  id: string
  actor_id: string | null
  type: string
  title: string
  body: string | null
  link_url: string | null
  is_read: boolean
  created_at: string
}

interface NotificationBellProps {
  userId: string
}

export function NotificationBell({ userId }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const hasLoadedRef = useRef(false)
  const { count, refresh } = useUnreadNotificationCount(userId)
  const { t, language } = useLanguage()
  const dateLocale = language === "en" ? enUS : it

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    hasLoadedRef.current = hasLoaded
  }, [hasLoaded])

  // Keeps an already-loaded list fresh in the background, so a notification that arrives while
  // the dropdown is closed (or open) is already there by the time the user clicks the bell -
  // reopening used to skip loadNotifications entirely once hasLoaded was true, so a new
  // notification created after the first open was never fetched.
  useEffect(() => {
    if (!userId) return

    const supabase = createClient()
    const channelName = `notification-bell-${userId}-${Math.random().toString(36).slice(2)}`
    const channel = supabase.channel(channelName)

    // Realtime postgres_changes events are not scoped by RLS on the wire (see
    // lib/chat/realtime.ts / use-unread-count.tsx) - filter server-side on recipient_id.
    channel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "notifications_domain", table: "notifications", filter: `recipient_id=eq.${userId}` },
        (payload) => {
          if (!hasLoadedRef.current) return
          const newNotification = payload.new as NotificationItem
          setNotifications((prev) =>
            prev.some((n) => n.id === newNotification.id) ? prev : [newNotification, ...prev]
          )
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.error("Notification bell realtime channel error")
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  const loadNotifications = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/notifications")
      if (!response.ok) throw new Error("Failed to fetch notifications")
      const data = await response.json()
      setNotifications(data.notifications ?? [])
      setHasMore(Boolean(data.hasMore))
      setHasLoaded(true)
    } catch (err) {
      console.error("Notifications fetch error:", err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadMoreNotifications = useCallback(async () => {
    const oldest = notifications[notifications.length - 1]
    if (!oldest) return
    try {
      setIsLoadingMore(true)
      const response = await fetch(`/api/notifications?before=${encodeURIComponent(oldest.created_at)}`)
      if (!response.ok) throw new Error("Failed to fetch notifications")
      const data = await response.json()
      setNotifications((current) => [...current, ...(data.notifications ?? [])])
      setHasMore(Boolean(data.hasMore))
    } catch (err) {
      console.error("Notifications fetch error:", err)
    } finally {
      setIsLoadingMore(false)
    }
  }, [notifications])

  const handleScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      if (isLoadingMore || !hasMore) return
      const el = event.currentTarget
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 48) {
        loadMoreNotifications()
      }
    },
    [hasMore, isLoadingMore, loadMoreNotifications]
  )

  const handleToggle = () => {
    const next = !isOpen
    setIsOpen(next)
    if (next && !hasLoaded) {
      loadNotifications()
    }
  }

  const markAsRead = useCallback(
    async (id: string) => {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
      try {
        await fetch(`/api/notifications/${id}/read`, { method: "POST" })
      } catch (err) {
        console.error("Mark notification as read error:", err)
      }
      refresh()
      window.dispatchEvent(new Event("notificationsUnreadCountRefresh"))
    },
    [refresh]
  )

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    try {
      await fetch("/api/notifications/read-all", { method: "POST" })
    } catch (err) {
      console.error("Mark all notifications as read error:", err)
    }
    refresh()
    window.dispatchEvent(new Event("notificationsUnreadCountRefresh"))
  }, [refresh])

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={handleToggle}
        className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label={t("nav.notifications")}
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-destructive px-1.5 text-[0.65rem] font-semibold text-destructive-foreground">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <p className="text-sm font-medium text-foreground">{t("notifications.title")}</p>
            {notifications.some((n) => !n.is_read) && (
              <button
                onClick={markAllAsRead}
                className="text-xs font-medium text-primary transition-colors hover:text-primary/80"
              >
                {t("notifications.mark_all_read")}
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto py-1" onScroll={handleScroll}>
            {isLoading && (
              <p className="px-3 py-4 text-center text-sm text-muted-foreground">{t("common.loading")}</p>
            )}

            {!isLoading && notifications.length === 0 && (
              <p className="px-3 py-4 text-center text-sm text-muted-foreground">{t("notifications.empty")}</p>
            )}

            {!isLoading &&
              notifications.map((notification) => (
                <Link
                  key={notification.id}
                  href={notification.link_url || "#"}
                  onClick={() => {
                    setIsOpen(false)
                    if (!notification.is_read) markAsRead(notification.id)
                  }}
                  className={`block px-3 py-2 text-sm transition-colors hover:bg-muted ${
                    notification.is_read ? "" : "bg-primary/5"
                  }`}
                >
                  <p className="font-medium text-foreground">{notification.title}</p>
                  {notification.body && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{notification.body}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: dateLocale })}
                  </p>
                </Link>
              ))}

            {!isLoading && isLoadingMore && (
              <p className="px-3 py-2 text-center text-xs text-muted-foreground">{t("common.loading")}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
