import { NextResponse } from "next/server"
import { requireApiUser } from "@/lib/auth/api"

interface ProfileUpdatePayload {
  displayName: string
  bio: string | null
  phone: string | null
}

/**
 * @swagger
 * /profile:
 *   patch:
 *     tags: [Profile]
 *     summary: Aggiorna nome visualizzato, bio e telefono del profilo del chiamante
 *     security:
 *       - supabaseSessionCookie: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [displayName]
 *             properties:
 *               displayName: { type: string }
 *               bio: { type: string, nullable: true }
 *               phone: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: Profilo aggiornato
 *       400:
 *         description: displayName mancante o vuoto
 *       401:
 *         description: Non autenticato
 *       500:
 *         description: Errore interno
 */
export async function PATCH(request: Request) {
  const { supabase, user, unauthorizedResponse } = await requireApiUser()
  if (unauthorizedResponse) {
    return unauthorizedResponse
  }

  const payload = (await request.json().catch(() => null)) as ProfileUpdatePayload | null
  const displayName = payload?.displayName?.trim()

  if (!displayName) {
    return NextResponse.json({ error: "Il nome visualizzato e obbligatorio" }, { status: 400 })
  }

  const { data, error } = await supabase
    .schema("users_domain")
    .from("profiles")
    .update({
      display_name: displayName,
      bio: payload?.bio?.trim() || null,
      phone: payload?.phone?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user!.id)
    .select("display_name, bio, phone")
    .single()

  if (error) {
    console.error("Profile update error:", error)
    return NextResponse.json({ error: "Impossibile salvare il profilo" }, { status: 500 })
  }

  return NextResponse.json({ profile: data })
}
