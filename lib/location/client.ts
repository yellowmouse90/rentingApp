export interface ClientLocation {
  lat: number
  lng: number
  name: string
}

function getGeoErrorMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Accesso alla posizione negato"
    case error.POSITION_UNAVAILABLE:
      return "Posizione non disponibile"
    case error.TIMEOUT:
      return "Timeout nella richiesta della posizione"
    default:
      return "Errore nella geolocalizzazione"
  }
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`
    )
    const data = await response.json()

    return (
      data.address?.city ||
      data.address?.town ||
      data.address?.village ||
      data.display_name?.split(",")[0] ||
      "Posizione rilevata"
    )
  } catch {
    return "Posizione rilevata"
  }
}

export async function detectCurrentLocation(): Promise<ClientLocation> {
  if (!navigator.geolocation) {
    throw new Error("La geolocalizzazione non e supportata dal tuo browser")
  }

  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000,
    })
  }).catch((error: GeolocationPositionError) => {
    throw new Error(getGeoErrorMessage(error))
  })

  const lat = position.coords.latitude
  const lng = position.coords.longitude
  const name = await reverseGeocode(lat, lng)

  return { lat, lng, name }
}

