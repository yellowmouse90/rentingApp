import { requireApiUser } from "@/lib/auth/api"
import { NextResponse } from "next/server"

/**
 * @swagger
 * /chat/unread-count:
 *   get:
 *     tags: [Chat]
 *     summary: Conteggio totale messaggi non letti dell'utente autenticato
 *     description: >
 *       Include esplicitamente i messaggi con sender_id NULL (mittente con profilo eliminato),
 *       che un semplice .neq() escluderebbe silenziosamente.
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

  const { data: conversations, error: convError } = await supabase
    .schema("interactions_domain")
    .from("conversations")
    .select("id")
    .or(`participant_one.eq.${user?.id},participant_two.eq.${user?.id}`)

  if (convError) {
    console.error("Unread count conversation query error:", convError)
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 }
    )
  }

  const conversationIds = (conversations || []).map((conversation) => conversation.id)
  if (conversationIds.length === 0) {
    return NextResponse.json({ unread_count: 0 })
  }

  // sender_id can be NULL for messages from a deleted account; `.neq()`
  // alone would silently exclude those rows since NULL <> value is unknown
  // in SQL, not true, so they must be included explicitly.
  const { count, error: messagesError } = await supabase
    .schema("interactions_domain")
    .from("messages")
    .select("id", { count: "exact", head: true })
    .in("conversation_id", conversationIds)
    .eq("is_read", false)
    .or(`sender_id.neq.${user?.id},sender_id.is.null`)

  if (messagesError) {
    console.error("Unread count messages query error:", messagesError)
    return NextResponse.json(
      { error: "Failed to fetch unread count" },
      { status: 500 }
    )
  }

  return NextResponse.json({ unread_count: count ?? 0 })
}
