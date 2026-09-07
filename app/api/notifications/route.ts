import { NextResponse } from "next/server"
import { requireApiUser } from "@/lib/auth/api"

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 50

/**
 * @swagger
 * /notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: Elenca le notifiche dell'utente autenticato (cursor-based)
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

  let query = supabase
    .schema("notifications_domain")
    .from("notifications")
    .select("id, actor_id, type, title, body, link_url, is_read, created_at")
    .eq("recipient_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(limit + 1)

  if (before) {
    query = query.lt("created_at", before)
  }

  const { data, error } = await query

  if (error) {
    console.error("Notifications fetch error:", error)
    return NextResponse.json({ error: "Impossibile recuperare le notifiche" }, { status: 500 })
  }

  const rows = data || []
  const hasMore = rows.length > limit
  const notifications = rows.slice(0, limit)

  return NextResponse.json({ notifications, hasMore })
}
