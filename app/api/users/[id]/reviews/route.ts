import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

interface PageParams {
  params: Promise<{ id: string }>
}

const PAGE_SIZE = 10

// Public endpoint (no auth required, same as app/users/[id]/page.tsx) -
// spec sez. 5: "ritorna solo review visible = true". RLS already limits
// anonymous reads to visible rows, but the explicit filter here also keeps
// a logged-in caller from seeing their own not-yet-published review of
// this target mixed into what is supposed to be the public list.
/**
 * @swagger
 * /users/{id}/reviews:
 *   get:
 *     tags: [Users]
 *     summary: Recensioni pubbliche visibili ricevute da un utente, paginate
 *     description: >
 *       Endpoint pubblico. Restituisce solo visible=true, filtrato esplicitamente per role e
 *       context (obbligatori).
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - name: role
 *         in: query
 *         required: true
 *         schema: { $ref: '#/components/schemas/ReviewTargetRole' }
 *       - name: context
 *         in: query
 *         required: true
 *         schema: { $ref: '#/components/schemas/ReviewContext' }
 *       - name: page
 *         in: query
 *         required: false
 *         schema: { type: integer, default: 1, minimum: 1 }
 *     responses:
 *       200:
 *         description: Pagina di recensioni (page size 10)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reviews:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string, format: uuid }
 *                       overall_rating: { type: integer }
 *                       sub_ratings: { type: object }
 *                       comment: { type: string, nullable: true }
 *                       tags: { type: array, items: { type: string } }
 *                       created_at: { type: string, format: date-time }
 *                       visible_at: { type: string, format: date-time, nullable: true }
 *                       author:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           id: { type: string }
 *                           display_name: { type: string, nullable: true }
 *                           avatar_url: { type: string, nullable: true }
 *                 total: { type: integer }
 *                 page: { type: integer }
 *                 page_size: { type: integer, enum: [10] }
 *       400:
 *         description: role o context mancante/non valido
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       500:
 *         description: Errore interno
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
export async function GET(request: NextRequest, { params }: PageParams) {
  try {
    const { id: userId } = await params
    const { searchParams } = new URL(request.url)
    const role = searchParams.get("role")
    const context = searchParams.get("context")
    const page = Math.max(1, Number(searchParams.get("page")) || 1)

    if (role !== "lender" && role !== "renter") {
      return NextResponse.json({ error: "Parametro role mancante o non valido" }, { status: 400 })
    }
    if (context !== "ferramenta" && context !== "p2p") {
      return NextResponse.json({ error: "Parametro context mancante o non valido" }, { status: 400 })
    }

    const supabase = await createClient()
    const from = (page - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    const { data, error, count } = await supabase
      .schema("reviews_domain")
      .from("reviews")
      .select("id, author_user_id, overall_rating, sub_ratings, comment, tags, created_at, visible_at", {
        count: "exact",
      })
      .eq("target_user_id", userId)
      .eq("target_role", role)
      .eq("context", context)
      .eq("visible", true)
      .order("visible_at", { ascending: false })
      .range(from, to)

    if (error) {
      console.error("User reviews: lettura fallita", error)
      return NextResponse.json({ error: "Impossibile leggere le recensioni" }, { status: 500 })
    }

    const authorIds = [...new Set((data || []).map((r) => r.author_user_id).filter(Boolean))]
    const { data: authors } = authorIds.length
      ? await supabase
          .schema("users_domain")
          .from("profiles")
          .select("id, display_name, avatar_url")
          .in("id", authorIds)
      : { data: [] }

    const authorById = new Map((authors || []).map((a) => [a.id, a]))
    const reviews = (data || []).map((r) => ({
      ...r,
      author: r.author_user_id ? authorById.get(r.author_user_id) ?? null : null,
    }))

    return NextResponse.json({
      reviews,
      total: count ?? reviews.length,
      page,
      page_size: PAGE_SIZE,
    })
  } catch (error) {
    console.error("User reviews API error:", error)
    return NextResponse.json({ error: "Errore durante la lettura delle recensioni" }, { status: 500 })
  }
}
