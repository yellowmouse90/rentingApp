import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

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
