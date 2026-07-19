export const ALERT_TYPES = [
  "booking_accepted",
  "booking_rejected",
  "booking_cancelled_by_renter",
  "booking_handover_confirmed",
  "booking_returned_ok",
  "booking_damage_reported",
  "payment_succeeded",
  "payment_failed",
  "stripe_onboarding_complete",
] as const

export type AlertType = (typeof ALERT_TYPES)[number]

export interface NotificationPreference {
  inApp: boolean
  email: boolean
}

// No preference rows are seeded for new users (no "on user created" hook
// exists anywhere in this repo) - a missing row for a given alert type just
// falls back to this default.
export const DEFAULT_PREFERENCES: Record<AlertType, NotificationPreference> = {
  booking_accepted: { inApp: true, email: true },
  booking_rejected: { inApp: true, email: true },
  booking_cancelled_by_renter: { inApp: true, email: true },
  booking_handover_confirmed: { inApp: true, email: true },
  booking_returned_ok: { inApp: true, email: true },
  booking_damage_reported: { inApp: true, email: true },
  payment_succeeded: { inApp: true, email: true },
  payment_failed: { inApp: true, email: true },
  stripe_onboarding_complete: { inApp: true, email: true },
}
