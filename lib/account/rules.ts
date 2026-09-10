// Pure business rule for account deletion eligibility - kept dependency-free
// (no Supabase client) so both the API route and unit tests can import it
// directly, mirroring lib/reviews/rules.ts. An account can only be deleted
// once every rental_orders row the user is a party to (as renter, or as
// owner via rental_items) has reached a terminal state - see the booking
// lifecycle in CLAUDE.md: pending -> accepted/cancelled -> paid ->
// in_progress -> completed | disputed. "disputed" has no further transition
// in app/api/bookings/[id]/transition/route.ts, so it counts as terminal
// even though it isn't a happy-path ending.
export const FINAL_ORDER_STATUSES = ["completed", "cancelled", "disputed"] as const

export type FinalOrderStatus = (typeof FINAL_ORDER_STATUSES)[number]

export function isFinalOrderStatus(status: string): boolean {
  return (FINAL_ORDER_STATUSES as readonly string[]).includes(status)
}

// Returns the statuses that are still blocking deletion (empty = eligible).
export function getBlockingOrderStatuses(statuses: string[]): string[] {
  return statuses.filter((status) => !isFinalOrderStatus(status))
}
