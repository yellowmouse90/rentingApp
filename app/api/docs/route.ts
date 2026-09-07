import { NextResponse } from "next/server"
import { getApiDocs } from "@/lib/swagger"

// Regenerated from the `@swagger` JSDoc blocks in app/api/**/*.ts on every request - the
// dev-time equivalent of Swashbuckle in a .NET project, not a hand-maintained snapshot.
// Disabled in production, same as Swagger is normally only wired up for Development there.
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Documentazione API non disponibile in produzione" }, { status: 404 })
  }

  return NextResponse.json(getApiDocs())
}
