import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

/**
 * @swagger
 * /debug/schema:
 *   get:
 *     tags: [Debug]
 *     summary: Espone tabelle/colonne dello schema interactions_domain via information_schema
 *     description: >
 *       Endpoint diagnostico usato in sviluppo; nessuna autenticazione né guardia d'ambiente nel
 *       codice attuale - da rimuovere o proteggere prima di esporre l'app in produzione.
 *     responses:
 *       200:
 *         description: Tabelle e colonne
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tables: { type: array, items: { type: object } }
 *                 columns: { type: array, items: { type: object } }
 *       500:
 *         description: Errore interno
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
export async function GET() {
  try {
    const supabase = await createClient()

    // Query the information_schema to get tables in interactions_domain schema
    const { data: tables, error: tablesError } = await supabase
      .from("information_schema.tables")
      .select("table_name, table_schema")
      .eq("table_schema", "interactions_domain")

    if (tablesError) throw tablesError

    // Get columns for each table
    const { data: columns, error: columnsError } = await supabase
      .from("information_schema.columns")
      .select("table_name, column_name, data_type, is_nullable")
      .eq("table_schema", "interactions_domain")

    if (columnsError) throw columnsError

    return NextResponse.json({
      tables,
      columns,
    })
  } catch (error) {
    console.error("Schema query error:", error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}
