import { NextResponse } from "next/server"
import { requireApiUser } from "@/lib/auth/api"
import { getEffectivePreferences } from "@/lib/notifications/preferences"
import { ALERT_TYPES, type AlertType } from "@/lib/notifications/types"

/**
 * @swagger
 * /notifications/preferences:
 *   get:
 *     tags: [Notifications]
 *     summary: Preferenze di notifica effettive del chiamante (default + override salvati)
 *     security:
 *       - supabaseSessionCookie: []
 *     responses:
 *       200:
 *         description: Preferenze per tipo di alert
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 preferences:
 *                   type: object
 *                   description: "Chiavi = AlertType"
 *                   additionalProperties:
 *                     type: object
 *                     properties:
 *                       inApp: { type: boolean }
 *                       email: { type: boolean }
 *       401:
 *         description: Non autenticato
 */
export async function GET() {
  const { supabase, user, unauthorizedResponse } = await requireApiUser()
  if (unauthorizedResponse) {
    return unauthorizedResponse
  }

  const preferences = await getEffectivePreferences(supabase, user!.id)

  return NextResponse.json({ preferences })
}

interface PreferencesPayload {
  alertType: AlertType
  inApp: boolean
  email: boolean
}

/**
 * @swagger
 * /notifications/preferences:
 *   put:
 *     tags: [Notifications]
 *     summary: Aggiorna la preferenza (in-app/email) per un tipo di alert
 *     security:
 *       - supabaseSessionCookie: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [alertType, inApp, email]
 *             properties:
 *               alertType: { $ref: '#/components/schemas/AlertType' }
 *               inApp: { type: boolean }
 *               email: { type: boolean }
 *     responses:
 *       200:
 *         description: Salvata
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Ok' }
 *       400:
 *         description: alertType mancante o non valido
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
export async function PUT(request: Request) {
  const { supabase, user, unauthorizedResponse } = await requireApiUser()
  if (unauthorizedResponse) {
    return unauthorizedResponse
  }

  const payload = (await request.json().catch(() => null)) as PreferencesPayload | null

  if (!payload || !ALERT_TYPES.includes(payload.alertType)) {
    return NextResponse.json({ error: "Tipo di alert non valido" }, { status: 400 })
  }

  const { error } = await supabase
    .schema("notifications_domain")
    .from("notification_preferences")
    .upsert(
      {
        user_id: user!.id,
        alert_type: payload.alertType,
        in_app_enabled: Boolean(payload.inApp),
        email_enabled: Boolean(payload.email),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,alert_type" }
    )

  if (error) {
    console.error("Notification preference update error:", error)
    return NextResponse.json({ error: "Impossibile salvare la preferenza" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
