import { NextRequest, NextResponse } from "next/server"
import { requireApiUser } from "@/lib/auth/api"

/**
 * @swagger
 * /notifications/device-tokens:
 *   post:
 *     tags: [Notifications]
 *     summary: Registra (o aggiorna) il token FCM del dispositivo dell'utente autenticato
 *     security:
 *       - supabaseSessionCookie: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token: { type: string }
 *               platform: { type: string, default: android }
 *     responses:
 *       200:
 *         description: Registrato
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Ok' }
 *       400:
 *         description: Token mancante
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Non autenticato
 *       500:
 *         description: Errore interno
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
export async function POST(request: NextRequest) {
  const { supabase, user, unauthorizedResponse } = await requireApiUser()
  if (unauthorizedResponse) {
    return unauthorizedResponse
  }

  const body = await request.json().catch(() => null)
  const token = typeof body?.token === "string" ? body.token : null
  const platform = typeof body?.platform === "string" ? body.platform : "android"

  if (!token) {
    return NextResponse.json({ error: "Token mancante" }, { status: 400 })
  }

  // `.select().single()` so an RLS-blocked write (e.g. a missing policy) fails loudly instead of
  // silently doing nothing - see CLAUDE.md's "RLS failure mode" section.
  const { data, error } = await supabase
    .schema("notifications_domain")
    .from("device_tokens")
    .upsert(
      { user_id: user!.id, token, platform, updated_at: new Date().toISOString() },
      { onConflict: "user_id,token" }
    )
    .select("id")
    .single()

  if (error || !data) {
    console.error("Device token registration error:", error)
    return NextResponse.json({ error: "Impossibile registrare il token" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

/**
 * @swagger
 * /notifications/device-tokens:
 *   delete:
 *     tags: [Notifications]
 *     summary: Rimuove il token FCM del dispositivo (es. al logout)
 *     security:
 *       - supabaseSessionCookie: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token: { type: string }
 *     responses:
 *       200:
 *         description: Rimosso (o già assente - idempotente)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Ok' }
 *       400:
 *         description: Token mancante
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Non autenticato
 */
export async function DELETE(request: NextRequest) {
  const { supabase, user, unauthorizedResponse } = await requireApiUser()
  if (unauthorizedResponse) {
    return unauthorizedResponse
  }

  const body = await request.json().catch(() => null)
  const token = typeof body?.token === "string" ? body.token : null

  if (!token) {
    return NextResponse.json({ error: "Token mancante" }, { status: 400 })
  }

  // No .select().single() here on purpose: unregistering an already-removed token (e.g. the
  // stale-token cleanup in lib/notifications/push.ts beat this call to it) is a legitimate no-op,
  // not an error - unlike the writes in CLAUDE.md's RLS section, 0 rows is an expected outcome.
  await supabase.schema("notifications_domain").from("device_tokens").delete().eq("user_id", user!.id).eq("token", token)

  return NextResponse.json({ ok: true })
}
