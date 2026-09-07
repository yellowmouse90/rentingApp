import { NextResponse } from "next/server"
import { requireApiUser } from "@/lib/auth/api"

/**
 * @swagger
 * /notifications/unread-count:
 *   get:
 *     tags: [Notifications]
 *     summary: Conteggio notifiche non lette del chiamante
 *     security:
 *       - supabaseSessionCookie: []
 *     responses:
 *       200:
 *         description: Conteggio
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 unread_count: { type: integer }
 *       401:
 *         description: Non autenticato
 *       500:
 *         description: Errore interno
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
export async function GET() {
  const { supabase, user, unauthorizedResponse } = await requireApiUser()
  if (unauthorizedResponse) {
    return unauthorizedResponse
  }

  const { count, error } = await supabase
    .schema("notifications_domain")
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", user!.id)
    .eq("is_read", false)

  if (error) {
    console.error("Notifications unread count error:", error)
    return NextResponse.json({ error: "Impossibile recuperare il conteggio" }, { status: 500 })
  }

  return NextResponse.json({ unread_count: count ?? 0 })
}
