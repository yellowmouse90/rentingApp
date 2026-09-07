import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ApiDocsClient } from "./api-docs-client"

export const metadata: Metadata = {
  title: "API Docs",
  robots: { index: false, follow: false },
}

// Dev-only, same as Swagger UI is normally only wired up for Development in a .NET project -
// the JSON it reads (app/api/docs/route.ts) is disabled in production too.
export default function ApiDocsPage() {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  return <ApiDocsClient />
}
