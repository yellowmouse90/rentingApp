import "server-only"

import type { AlertType } from "./types"

export interface CopyParams {
  actorName?: string
  orderId?: string
}

type Language = "it" | "en"

// Notification title/body are pre-rendered and persisted at insert time
// (not looked up live like the rest of the UI's dictionaries in
// lib/i18n/*), so historical notifications stay frozen in whatever language
// they were created in and the bell list never needs a join back to
// order/listing data just to render.
function shortId(orderId?: string) {
  return orderId ? orderId.slice(0, 8) : ""
}

type CopyFn = (params: CopyParams) => { title: string; body: string }

const COPY: Record<AlertType, Record<Language, CopyFn>> = {
  booking_accepted: {
    it: (p) => ({
      title: "Prenotazione accettata",
      body: `${p.actorName ?? "Il proprietario"} ha accettato la tua richiesta di noleggio #${shortId(p.orderId)}.`,
    }),
    en: (p) => ({
      title: "Booking accepted",
      body: `${p.actorName ?? "The owner"} accepted your rental request #${shortId(p.orderId)}.`,
    }),
  },
  booking_rejected: {
    it: (p) => ({
      title: "Prenotazione rifiutata",
      body: `${p.actorName ?? "Il proprietario"} ha rifiutato la tua richiesta di noleggio #${shortId(p.orderId)}.`,
    }),
    en: (p) => ({
      title: "Booking declined",
      body: `${p.actorName ?? "The owner"} declined your rental request #${shortId(p.orderId)}.`,
    }),
  },
  booking_cancelled_by_renter: {
    it: (p) => ({
      title: "Prenotazione annullata",
      body: `${p.actorName ?? "Il noleggiatore"} ha annullato la richiesta di noleggio #${shortId(p.orderId)}.`,
    }),
    en: (p) => ({
      title: "Booking cancelled",
      body: `${p.actorName ?? "The renter"} cancelled the rental request #${shortId(p.orderId)}.`,
    }),
  },
  booking_handover_confirmed: {
    it: () => ({
      title: "Consegna confermata",
      body: "Il proprietario ha confermato la consegna: il tuo noleggio è ora attivo.",
    }),
    en: () => ({
      title: "Handover confirmed",
      body: "The owner confirmed the handover: your rental is now active.",
    }),
  },
  booking_returned_ok: {
    it: (p) => ({
      title: "Noleggio completato",
      body: `Il noleggio #${shortId(p.orderId)} è stato completato: l'attrezzo è stato restituito integro.`,
    }),
    en: (p) => ({
      title: "Rental completed",
      body: `Rental #${shortId(p.orderId)} is complete: the tool was returned in good condition.`,
    }),
  },
  booking_damage_reported: {
    it: (p) => ({
      title: "Danno segnalato",
      body: `Il proprietario ha segnalato un danno per il noleggio #${shortId(p.orderId)}. Controlla i dettagli.`,
    }),
    en: (p) => ({
      title: "Damage reported",
      body: `The owner reported damage for rental #${shortId(p.orderId)}. Check the details.`,
    }),
  },
  payment_succeeded: {
    it: (p) => ({
      title: "Pagamento riuscito",
      body: `Il pagamento per il noleggio #${shortId(p.orderId)} è andato a buon fine.`,
    }),
    en: (p) => ({
      title: "Payment succeeded",
      body: `The payment for rental #${shortId(p.orderId)} was successful.`,
    }),
  },
  payment_failed: {
    it: (p) => ({
      title: "Pagamento non riuscito",
      body: `Il pagamento per il noleggio #${shortId(p.orderId)} non è andato a buon fine. Verifica il metodo di pagamento.`,
    }),
    en: (p) => ({
      title: "Payment failed",
      body: `The payment for rental #${shortId(p.orderId)} failed. Please check your payment method.`,
    }),
  },
  stripe_onboarding_complete: {
    it: () => ({
      title: "Configurazione pagamenti completata",
      body: "Il tuo account Stripe è pronto: ora puoi ricevere pagamenti dai tuoi noleggi.",
    }),
    en: () => ({
      title: "Payment setup complete",
      body: "Your Stripe account is ready: you can now receive payments for your rentals.",
    }),
  },
}

export function getNotificationCopy(type: AlertType, language: Language, params: CopyParams) {
  return COPY[type][language](params)
}

export function getNotificationLinkUrl(type: AlertType, orderId?: string): string | null {
  if (type === "stripe_onboarding_complete") return "/dashboard/payments"
  return orderId ? `/bookings/${orderId}` : null
}
