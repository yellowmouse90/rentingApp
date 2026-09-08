import { requireApiUser } from "@/lib/auth/api"
import { NextResponse } from "next/server"

/**
 * @swagger
 * /chat/messages/read:
 *   post:
 *     tags: [Chat]
 *     summary: Segna una lista di messaggi come letti
 *     security:
 *       - supabaseSessionCookie: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [conversationId, messageIds]
 *             properties:
 *               conversationId: { type: string, format: uuid }
 *               messageIds:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *                 minItems: 1
 *     responses:
 *       200:
 *         description: Aggiornati
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *       400:
 *         description: Campi mancanti
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       500:
 *         description: Errore interno
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
export async function POST(request: Request) {
  try {
    const { supabase, unauthorizedResponse } = await requireApiUser()
    if (unauthorizedResponse) {
      return unauthorizedResponse
    }

    const { conversationId, messageIds } = await request.json()

    if (!conversationId || !messageIds || messageIds.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Mark messages as read
    const { error } = await supabase
      .schema("interactions_domain")
      .from("messages")
      .update({ is_read: true })
      .in("id", messageIds)
      .eq("conversation_id", conversationId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Mark as read error:", error)
    return NextResponse.json(
      { error: "Failed to mark messages as read" },
      { status: 500 }
    )
  }
}
