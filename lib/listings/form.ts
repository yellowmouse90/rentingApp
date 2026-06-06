import type { ClientLocation } from "@/lib/location/client"

interface ListingPriceInput {
  pricePerDay: string
  pricePerWeek: string
  deposit: string
}

interface ListingPriceOutput {
  pricePerDayCents: number
  pricePerWeekCents: number | null
  depositCents: number
}

function parseEuroToCents(value: string): number {
  const parsed = parseFloat(value)
  return Math.round(parsed * 100)
}

export function parseListingPrices(input: ListingPriceInput): ListingPriceOutput {
  const pricePerDayCents = parseEuroToCents(input.pricePerDay)

  if (!Number.isFinite(pricePerDayCents) || pricePerDayCents <= 0) {
    throw new Error("Il prezzo giornaliero deve essere maggiore di zero")
  }

  const pricePerWeekCents = input.pricePerWeek ? parseEuroToCents(input.pricePerWeek) : null
  const depositCents = input.deposit ? parseEuroToCents(input.deposit) : 0

  if (pricePerWeekCents !== null && !Number.isFinite(pricePerWeekCents)) {
    throw new Error("Prezzo settimanale non valido")
  }

  if (!Number.isFinite(depositCents)) {
    throw new Error("Cauzione non valida")
  }

  return {
    pricePerDayCents,
    pricePerWeekCents,
    depositCents,
  }
}

export function locationToPointWkt(location: Pick<ClientLocation, "lat" | "lng"> | null): string | null {
  if (!location || location.lat === 0 || location.lng === 0) {
    return null
  }

  return `POINT(${location.lng} ${location.lat})`
}

export function pointWktToLocation(
  pointWkt: string | null,
  fallbackName: string | null
): ClientLocation | null {
  if (!pointWkt) {
    if (!fallbackName) return null
    return { lat: 0, lng: 0, name: fallbackName }
  }

  const match = pointWkt.match(/POINT\(([-0-9.]+)\s+([-0-9.]+)\)/)
  if (!match) {
    return fallbackName ? { lat: 0, lng: 0, name: fallbackName } : null
  }

  return {
    lng: parseFloat(match[1]),
    lat: parseFloat(match[2]),
    name: fallbackName || "Posizione salvata",
  }
}

