import { NextResponse } from "next/server"
import { requireApiUser } from "@/lib/auth/api"

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 50
const INITIAL_READ_LIMIT = 5
const MAX_UNREAD = 100

const SELECT_COLUMNS = "id, actor_id, type, title, body, link_url, is_read, created_at"

/**
 * @swagger
 * /notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: Elenca le notifiche dell'utente autenticato (cursor-based)
 *     description: >
 *       Senza `before`, restituisce tutte le notifiche da leggere piu le ultime
 *       5 gia lette. Con `before`, pagina all'indietro solo tra le notifiche
 *       gia lette (quelle da leggere sono sempre incluse nel primo carico).
 *     security:
 *       - supabaseSessionCookie: []
 *     parameters:
 *       - name: before
 *         in: query
 *         required: false
 *         schema: { type: string, format: date-time }
 *       - name: limit
 *         in: query
 *         required: false
 *         schema: { type: integer, default: 20, maximum: 50 }
 *     responses:
 *       200:
 *         description: Pagina di notifiche
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 notifications:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Notification' }
 *                 hasMore: { type: boolean }
 *       401:
 *         description: Non autenticato
 *       500:
 *         description: Errore interno
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
export async function GET(request: Request) {
  const { supabase, user, unauthorizedResponse } = await requireApiUser()
  if (unauthorizedResponse) {
    return unauthorizedResponse
  }

  const { searchParams } = new URL(request.url)
  const before = searchParams.get("before")
  const limitParam = parseInt(searchParams.get("limit") || "", 10)
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(limitParam, 1), MAX_PAGE_SIZE)
    : DEFAULT_PAGE_SIZE

  // Paginating: everything unread is already loaded up front, so a `before` cursor only ever
  // needs to page further back through already-read notifications.
  if (before) {
    const { data, error } = await supabase
      .schema("notifications_domain")
      .from("notifications")
      .select(SELECT_COLUMNS)
      .eq("recipient_id", user!.id)
      .eq("is_read", true)
      .lt("created_at", before)
      .order("created_at", { ascending: false })
      .limit(limit + 1)

    if (error) {
      console.error("Notifications fetch error:", error)
      return NextResponse.json({ error: "Impossibile recuperare le notifiche" }, { status: 500 })
    }

    const rows = data || []
    const hasMore = rows.length > limit
    return NextResponse.json({ notifications: rows.slice(0, limit), hasMore })
  }

  // Initial load: everything unread plus the last few already-read ones.
  const [unreadResult, readResult] = await Promise.all([
    supabase
      .schema("notifications_domain")
      .from("notifications")
      .select(SELECT_COLUMNS)
      .eq("recipient_id", user!.id)
      .eq("is_read", false)
      .order("created_at", { ascending: false })
      .limit(MAX_UNREAD),
    supabase
      .schema("notifications_domain")
      .from("notifications")
      .select(SELECT_COLUMNS)
      .eq("recipient_id", user!.id)
      .eq("is_read", true)
      .order("created_at", { ascending: false })
      .limit(INITIAL_READ_LIMIT + 1),
  ])

  if (unreadResult.error || readResult.error) {
    console.error("Notifications fetch error:", unreadResult.error || readResult.error)
    return NextResponse.json({ error: "Impossibile recuperare le notifiche" }, { status: 500 })
  }

  const unread = unreadResult.data || []
  const readRows = readResult.data || []
  const hasMore = readRows.length > INITIAL_READ_LIMIT
  const read = readRows.slice(0, INITIAL_READ_LIMIT)

  const notifications = [...unread, ...read].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  return NextResponse.json({ notifications, hasMore })
}
