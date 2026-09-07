import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

interface PageParams {
  params: Promise<{ id: string }>
}

// Public endpoint - powers the stars/badge on a public profile. Returns
// every (role, context) combination that has at least one summary row;
// most users will only ever have one (lender/ferramenta) in phase 1.
/**
 * @swagger
 * /users/{id}/rating-summary:
 *   get:
 *     tags: [Users]
 *     summary: Riepiloghi valutazione pubblici di un utente (per ruolo e contesto)
 *     description: >
 *       Endpoint pubblico (nessuna autenticazione). Restituisce ogni combinazione (role, context)
 *       con almeno una riga in reviews_domain.user_rating_summaries.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Riepiloghi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 summaries:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       user_id: { type: string, format: uuid }
 *                       role: { $ref: '#/components/schemas/ReviewTargetRole' }
 *                       context: { $ref: '#/components/schemas/ReviewContext' }
 *                       average_rating: { type: number }
 *                       review_count: { type: integer }
 *                       tag_frequency: { type: object }
 *       500:
 *         description: Errore interno
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
export async function GET(_request: NextRequest, { params }: PageParams) {
  try {
    const { id: userId } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .schema("reviews_domain")
      .from("user_rating_summaries")
      .select("user_id, role, context, average_rating, review_count, tag_frequency")
      .eq("user_id", userId)

    if (error) {
      console.error("Rating summary: lettura fallita", error)
      return NextResponse.json({ error: "Impossibile leggere la valutazione" }, { status: 500 })
    }

    return NextResponse.json({ summaries: data || [] })
  } catch (error) {
    console.error("Rating summary API error:", error)
    return NextResponse.json({ error: "Errore durante la lettura della valutazione" }, { status: 500 })
  }
}
