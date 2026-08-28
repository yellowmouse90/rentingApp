const FALLBACK_URL = "http://localhost:3000"

// Resolves the canonical site URL without requiring a purchased domain yet:
// falls back to the stable Vercel production URL, then the deploy-specific one.
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL
  if (explicit) return explicit.replace(/\/$/, "")

  const prodUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  if (prodUrl) return `https://${prodUrl}`

  const deploymentUrl = process.env.VERCEL_URL
  if (deploymentUrl) return `https://${deploymentUrl}`

  return FALLBACK_URL
}

export const SITE_NAME = "Pietro"

export const DEFAULT_DESCRIPTION =
  "La piattaforma di sharing economy per noleggiare attrezzi da lavoro tra privati. Trova l'attrezzo che ti serve o metti a reddito i tuoi."
