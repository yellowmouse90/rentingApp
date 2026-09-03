// Pure business rules for the review system - kept dependency-free (no
// Supabase client, no server-only imports) so both API routes and unit
// tests can import it directly. Mirrors the DB-level checks in
// db/migrations/012_create_reviews_schema.sql (reviews_domain.can_submit_review,
// reviews_domain.apply_visibility_rules), which are the actual RLS
// authorization boundary - this module exists to produce good, specific
// error messages before that boundary is hit, not to replace it.
import type { ReviewContext, ReviewTargetRole } from "@/lib/types"

// Spec sez. 3.2: finestra per lasciare la recensione, 14 giorni dalla
// chiusura booking (configurabile).
export const REVIEW_WINDOW_DAYS = 14

export const MAX_COMMENT_LENGTH = 2000
export const MAX_TAGS = 6
export const MAX_TAG_LENGTH = 40

// Spec sez. 2 - chiave-valore flessibile apposta (non colonne fisse) così i
// criteri si possono cambiare senza migration; questa mappa è solo il seed
// UI-side usato per renderizzare le chip, non è validata rigidamente lato
// server (sub_ratings extra o mancanti sono accettati, l'unico campo
// obbligatorio è overall_rating - vedi nota implementativa in fondo alla
// sez. 2 dello spec).
export const SUB_RATING_KEYS: Record<ReviewTargetRole, Record<ReviewContext, string[]>> = {
  lender: {
    ferramenta: ["item_match", "item_condition", "pickup_timeliness", "service"],
    p2p: ["item_match", "item_condition", "delivery_timeliness", "communication", "trust_overall"],
  },
  renter: {
    // Stessi criteri per entrambi i context (spec sez. 2).
    ferramenta: ["item_care", "return_timeliness", "cleanliness", "communication", "trust_overall"],
    p2p: ["item_care", "return_timeliness", "cleanliness", "communication", "trust_overall"],
  },
}

export function getSubRatingKeys(targetRole: ReviewTargetRole, context: ReviewContext): string[] {
  return SUB_RATING_KEYS[targetRole][context]
}

// Spec sez. 1: "target_role deve essere coerente con il ruolo che il
// target aveva effettivamente in quella booking" - context si deriva da
// chi presta (lender) nella booking, non dal client: un account business
// ("ferramenta") genera sempre context='ferramenta', un privato 'p2p'.
export function deriveReviewContext(lenderAccountType: "individual" | "business"): ReviewContext {
  return lenderAccountType === "business" ? "ferramenta" : "p2p"
}

// Spec sez. 3.3/6: le ferramenta ricevono recensioni pubbliche solo come
// lender - una recensione ferramenta->noleggiatore è consentita ma resta
// una nota interna, mai pubblica (vedi reviews_domain.apply_visibility_rules
// nella migration).
export function isPubliclyReviewable(context: ReviewContext, targetRole: ReviewTargetRole): boolean {
  return !(context === "ferramenta" && targetRole === "renter")
}

export function isWithinReviewWindow(bookingClosedAt: string | Date, now: Date = new Date()): boolean {
  const closedAt = typeof bookingClosedAt === "string" ? new Date(bookingClosedAt) : bookingClosedAt
  const deadline = new Date(closedAt.getTime() + REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  return now.getTime() <= deadline.getTime()
}

export interface ReviewInput {
  overall_rating: number
  sub_ratings?: Record<string, number>
  comment?: string | null
  tags?: string[]
}

// Field-shape validation only (rating range, comment length, tag count) -
// participant/role/window/context checks need booking data the caller
// already has, so those stay as separate checks in the API route rather
// than being folded into this generic input validator.
export function validateReviewInput(input: ReviewInput): string[] {
  const errors: string[] = []

  if (!Number.isInteger(input.overall_rating) || input.overall_rating < 1 || input.overall_rating > 5) {
    errors.push("overall_rating deve essere un intero tra 1 e 5")
  }

  if (input.sub_ratings) {
    for (const [key, value] of Object.entries(input.sub_ratings)) {
      if (!Number.isInteger(value) || value < 1 || value > 5) {
        errors.push(`sub_ratings.${key} deve essere un intero tra 1 e 5`)
      }
    }
  }

  if (input.comment != null && input.comment.length > MAX_COMMENT_LENGTH) {
    errors.push(`comment supera i ${MAX_COMMENT_LENGTH} caratteri`)
  }

  if (input.tags) {
    if (input.tags.length > MAX_TAGS) {
      errors.push(`sono ammessi al massimo ${MAX_TAGS} tag`)
    }
    if (input.tags.some((tag) => typeof tag !== "string" || tag.length === 0 || tag.length > MAX_TAG_LENGTH)) {
      errors.push(`ogni tag deve essere una stringa non vuota di massimo ${MAX_TAG_LENGTH} caratteri`)
    }
  }

  return errors
}

// Suggested chips for the review form (spec sez. 6: "chip opzionali per i
// tag") - purely a UI affordance, the tags column accepts any string so
// this list can grow without a migration.
export const SUGGESTED_TAGS: Record<ReviewTargetRole, string[]> = {
  lender: ["Attrezzo perfetto", "Puntuale", "Cordiale", "Come descritto", "Consigliato"],
  renter: ["Nessun danno", "Puntuale alla riconsegna", "Buona comunicazione", "Consigliato"],
}
