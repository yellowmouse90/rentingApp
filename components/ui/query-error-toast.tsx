"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { emitToast } from "./toast-provider"

/**
 * Mounted once globally. Lets route handlers that redirect (no page of their
 * own to render a toast from, e.g. the auth callback) surface a DB error by
 * appending `?dbError=<message>` to the redirect target. Strips the param
 * from the URL right after showing it so it can't be replayed on refresh/share.
 */
export function QueryErrorToast() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const dbError = searchParams.get("dbError")

  useEffect(() => {
    if (!dbError) return
    emitToast(dbError, "error")

    const params = new URLSearchParams(searchParams.toString())
    params.delete("dbError")
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbError])

  return null
}
