"use client"

import { useState, useEffect, useCallback } from "react"
import { MapPin, Navigation, Loader2, X } from "lucide-react"
import { detectCurrentLocation } from "@/lib/location/client"

interface LocationSearchProps {
  onLocationChange: (lat: number, lng: number, name: string) => void
  currentLocation?: { lat: number; lng: number; name: string } | null
  radius: number
  onRadiusChange: (radius: number) => void
}

const radiusOptions = [
  { value: 5, label: "5 km" },
  { value: 10, label: "10 km" },
  { value: 25, label: "25 km" },
  { value: 50, label: "50 km" },
  { value: 100, label: "100 km" },
]

export function LocationSearch({
  onLocationChange,
  currentLocation,
  radius,
  onRadiusChange,
}: LocationSearchProps) {
  const [isLocating, setIsLocating] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [manualAddress, setManualAddress] = useState("")
  const [showManualInput, setShowManualInput] = useState(false)

  const detectLocation = useCallback(async () => {
    setIsLocating(true)
    setLocationError(null)

    try {
      const detected = await detectCurrentLocation()
      onLocationChange(detected.lat, detected.lng, detected.name)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Errore nella geolocalizzazione"
      setLocationError(message)
      setShowManualInput(true)
    } finally {
      setIsLocating(false)
    }
  }, [onLocationChange])

  const searchAddress = async () => {
    if (!manualAddress.trim()) return

    setIsLocating(true)
    setLocationError(null)

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(manualAddress)}&countrycodes=it&limit=1`
      )
      const data = await response.json()

      if (data && data.length > 0) {
        const result = data[0]
        onLocationChange(
          parseFloat(result.lat),
          parseFloat(result.lon),
          result.display_name.split(",")[0]
        )
        setShowManualInput(false)
        setManualAddress("")
      } else {
        setLocationError("Indirizzo non trovato. Prova con un altro indirizzo.")
      }
    } catch {
      setLocationError("Errore nella ricerca dell'indirizzo")
    }

    setIsLocating(false)
  }

  const clearLocation = () => {
    onLocationChange(0, 0, "")
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <MapPin className="h-4 w-4 text-primary" />
          Posizione
        </h3>
        {currentLocation && currentLocation.lat !== 0 && (
          <button
            onClick={clearLocation}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {currentLocation && currentLocation.lat !== 0 ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2">
            <MapPin className="h-4 w-4 text-primary" />
            <span className="flex-1 text-sm font-medium text-foreground">
              {currentLocation.name}
            </span>
          </div>

          {/* Radius selector */}
          <div>
            <label className="mb-2 block text-xs text-muted-foreground">
              Raggio di ricerca
            </label>
            <div className="flex flex-wrap gap-2">
              {radiusOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => onRadiusChange(option.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    radius === option.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={detectLocation}
            disabled={isLocating}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {isLocating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Navigation className="h-4 w-4" />
            )}
            Aggiorna posizione
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <button
            onClick={detectLocation}
            disabled={isLocating}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isLocating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Navigation className="h-4 w-4" />
            )}
            Usa la mia posizione
          </button>

          <button
            onClick={() => setShowManualInput(!showManualInput)}
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            {showManualInput ? "Nascondi" : "Inserisci manualmente"}
          </button>

          {showManualInput && (
            <div className="space-y-2">
              <input
                type="text"
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                placeholder="Inserisci citta o indirizzo..."
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                onKeyDown={(e) => e.key === "Enter" && searchAddress()}
              />
              <button
                onClick={searchAddress}
                disabled={isLocating || !manualAddress.trim()}
                className="w-full rounded-lg bg-muted px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/80 disabled:opacity-50"
              >
                Cerca
              </button>
            </div>
          )}

          {locationError && (
            <p className="text-xs text-destructive">{locationError}</p>
          )}
        </div>
      )}
    </div>
  )
}
