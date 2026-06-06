"use client"

import Link from "next/link"
import { MessageSquare } from "lucide-react"
import { useUnreadMessageCount } from "@/lib/chat/use-unread-count"

interface ChatNotificationProps {
  userId: string
}

export function ChatNotification({ userId }: ChatNotificationProps) {
  const { count } = useUnreadMessageCount(userId)

  return (
    <Link
      href="/messages"
      className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      aria-label="Messaggi"
    >
      <MessageSquare className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-destructive px-1.5 text-[0.65rem] font-semibold text-destructive-foreground">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  )
}
