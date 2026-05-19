import { cookies } from "next/headers"
import { enUS, it } from "date-fns/locale"
import type { Locale } from "date-fns"

type Language = "it" | "en"

const serverTranslations: Record<Language, Record<string, string>> = {
  it: {
    "dashboard.welcome": "Benvenuto",
    "dashboard.new_listing": "Nuovo annuncio",
    "dashboard.my_listings": "I miei annunci",
    "dashboard.received_rentals": "Noleggi ricevuti",
    "dashboard.made_rentals": "Noleggi effettuati",
    "dashboard.manage_listings.title": "Gestisci annunci",
    "dashboard.manage_listings.desc": "Modifica o rimuovi i tuoi annunci",
    "dashboard.my_rentals.title": "I miei noleggi",
    "dashboard.my_rentals.desc": "Visualizza le tue prenotazioni",

    "dashboard_listings.back": "Torna alla dashboard",
    "dashboard_listings.title": "I tuoi prodotti",
    "dashboard_listings.subtitle": "Gestisci annunci attivi e archiviati",
    "dashboard_listings.new_product": "Nuovo prodotto",
    "dashboard_listings.empty_title": "Nessun prodotto pubblicato",
    "dashboard_listings.empty_desc": "Pubblica il primo prodotto per iniziare a ricevere richieste di noleggio.",
    "dashboard_listings.publish_product": "Pubblica un prodotto",
    "dashboard_listings.active": "Attivo",
    "dashboard_listings.archived": "Archiviato",
    "dashboard_listings.unavailable": "Non disponibile",
    "dashboard_listings.category": "Categoria",
    "dashboard_listings.created_on": "Creato il",
    "dashboard_listings.per_day": "/giorno",

    "bookings.title": "I miei noleggi",
    "bookings.made": "Noleggi effettuati",
    "bookings.made_empty": "Non hai ancora effettuato noleggi",
    "bookings.explore": "Esplora gli annunci",
    "bookings.received": "Richieste ricevute",
    "bookings.received_empty": "Non hai ancora ricevuto richieste",
    "bookings.publish_listing": "Pubblica un annuncio",
    "bookings.removed_listing": "Annuncio rimosso",
    "bookings.request_from": "Richiesta da",

    "booking_new.back": "Torna all'annuncio",
    "booking_new.title": "Conferma prenotazione",
    "booking_new.no_img": "No img",
    "booking_new.by": "di",
    "booking_new.day": "giorno",
    "booking_new.days": "giorni",
    "booking_new.service_fee": "Commissione servizio",
    "booking_new.deposit_refundable": "Cauzione (rimborsabile)",
    "booking_new.total": "Totale",
    "booking_new.secure_payment": "Pagamento sicuro",
    "booking_new.protected_by_stripe": "Protetto da Stripe",
    "booking_new.free_cancellation": "Cancellazione gratuita",
    "booking_new.free_cancellation_until": "Fino a 24h prima",

    "listing_detail.back": "Torna agli annunci",
    "listing_detail.archived_notice": "Questo annuncio e archiviato: non e visibile pubblicamente ne prenotabile.",
    "listing_detail.deposit": "Cauzione",
    "listing_detail.per_day": "/giorno",
    "listing_detail.or": "oppure",
    "listing_detail.per_week": "/settimana",
    "listing_detail.description": "Descrizione",
    "listing_detail.no_description": "Nessuna descrizione disponibile.",
    "listing_detail.owner": "Proprietario",
    "listing_detail.reviews": "recensioni",
    "listing_detail.member_since": "Membro dal",
    "listing_detail.contact_owner": "Contatta",
    "listing_detail.contact_owner_fallback": "il proprietario",
    "listing_detail.safe_rental": "Noleggio sicuro",
    "listing_detail.safe_rental_desc": "Tutti i pagamenti sono protetti. La cauzione viene trattenuta e rilasciata dopo il ritorno dell'attrezzo.",

    "api.common.unauthorized": "Non autorizzato",
    "api.listings.not_found": "Prodotto non trovato",
    "api.listings.forbidden": "Operazione non consentita",
    "api.listings.delete_error": "Errore durante l'eliminazione",
    "api.common.internal_error": "Errore interno",
  },
  en: {
    "dashboard.welcome": "Welcome",
    "dashboard.new_listing": "New listing",
    "dashboard.my_listings": "My listings",
    "dashboard.received_rentals": "Rentals received",
    "dashboard.made_rentals": "Rentals made",
    "dashboard.manage_listings.title": "Manage listings",
    "dashboard.manage_listings.desc": "Edit or remove your listings",
    "dashboard.my_rentals.title": "My rentals",
    "dashboard.my_rentals.desc": "View your bookings",

    "dashboard_listings.back": "Back to dashboard",
    "dashboard_listings.title": "Your products",
    "dashboard_listings.subtitle": "Manage active and archived listings",
    "dashboard_listings.new_product": "New product",
    "dashboard_listings.empty_title": "No products published",
    "dashboard_listings.empty_desc": "Publish your first product to start receiving rental requests.",
    "dashboard_listings.publish_product": "Publish a product",
    "dashboard_listings.active": "Active",
    "dashboard_listings.archived": "Archived",
    "dashboard_listings.unavailable": "Unavailable",
    "dashboard_listings.category": "Category",
    "dashboard_listings.created_on": "Created on",
    "dashboard_listings.per_day": "/day",

    "bookings.title": "My rentals",
    "bookings.made": "Rentals made",
    "bookings.made_empty": "You have not made any rentals yet",
    "bookings.explore": "Explore listings",
    "bookings.received": "Requests received",
    "bookings.received_empty": "You have not received any requests yet",
    "bookings.publish_listing": "Publish a listing",
    "bookings.removed_listing": "Listing removed",
    "bookings.request_from": "Request from",

    "booking_new.back": "Back to listing",
    "booking_new.title": "Confirm booking",
    "booking_new.no_img": "No image",
    "booking_new.by": "by",
    "booking_new.day": "day",
    "booking_new.days": "days",
    "booking_new.service_fee": "Service fee",
    "booking_new.deposit_refundable": "Deposit (refundable)",
    "booking_new.total": "Total",
    "booking_new.secure_payment": "Secure payment",
    "booking_new.protected_by_stripe": "Protected by Stripe",
    "booking_new.free_cancellation": "Free cancellation",
    "booking_new.free_cancellation_until": "Up to 24h before",

    "listing_detail.back": "Back to listings",
    "listing_detail.archived_notice": "This listing is archived: it is not publicly visible and cannot be booked.",
    "listing_detail.deposit": "Deposit",
    "listing_detail.per_day": "/day",
    "listing_detail.or": "or",
    "listing_detail.per_week": "/week",
    "listing_detail.description": "Description",
    "listing_detail.no_description": "No description available.",
    "listing_detail.owner": "Owner",
    "listing_detail.reviews": "reviews",
    "listing_detail.member_since": "Member since",
    "listing_detail.contact_owner": "Contact",
    "listing_detail.contact_owner_fallback": "owner",
    "listing_detail.safe_rental": "Safe rental",
    "listing_detail.safe_rental_desc": "All payments are protected. The deposit is held and released after the tool is returned.",

    "api.common.unauthorized": "Unauthorized",
    "api.listings.not_found": "Product not found",
    "api.listings.forbidden": "Operation not allowed",
    "api.listings.delete_error": "Error while deleting",
    "api.common.internal_error": "Internal error",
  },
}

async function getServerLanguage(): Promise<Language> {
  const cookieStore = await cookies()
  const lang = cookieStore.get("toolshare_language")?.value

  if (lang === "it" || lang === "en") {
    return lang
  }

  return "it"
}

export async function getServerI18n() {
  const language = await getServerLanguage()
  const dict = serverTranslations[language]

  return {
    language,
    t: (key: string) => dict[key] || key,
    dateLocale: language === "en" ? (enUS as Locale) : (it as Locale),
    intlLocale: language === "en" ? "en-US" : "it-IT",
  }
}
