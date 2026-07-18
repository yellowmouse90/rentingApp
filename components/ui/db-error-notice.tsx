"use client"

import { useEffect, useRef } from "react"
import { emitToast } from "./toast-provider"

/**
 * Drop this into a server component wherever a Supabase query's `error` is
 * otherwise discarded. Renders nothing itself — it only surfaces the error
 * as a toast once hydrated, so failures that today are invisible (e.g. wrong
 * schema name, missing grants) become visible in the UI.
 */
export function DbErrorNotice({ message }: { message?: string | null }) {
  const shown = useRef<string | null>(null)

  useEffect(() => {
    if (!message || shown.current === message) return
    shown.current = message
    emitToast(message, "error")
  }, [message])

  return null
}
