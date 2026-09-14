// Pure business rules for chat send-eligibility - kept dependency-free (no
// Supabase client) so both the messages API route and the web/Flutter UIs
// can mirror the same logic, following lib/reviews/rules.ts and
// lib/account/rules.ts. The API route is the actual enforcement boundary;
// this module exists so the client-side "disable the input" UX agrees with
// it instead of drifting.
import { isFinalOrderStatus } from "@/lib/account/rules"

// Spec: una chat con un ordine in stato terminale resta scrivibile ancora
// per un po' dopo la chiusura, poi si blocca.
export const CHAT_LOCK_GRACE_DAYS = 2

export type ChatLockReason = "deleted_counterpart" | "order_closed"

export function isOrderChatLocked(
  status: string | null | undefined,
  updatedAt: string | Date | null | undefined,
  now: Date = new Date()
): boolean {
  if (!status || !updatedAt || !isFinalOrderStatus(status)) return false

  const updated = typeof updatedAt === "string" ? new Date(updatedAt) : updatedAt
  const graceDeadline = new Date(updated.getTime() + CHAT_LOCK_GRACE_DAYS * 24 * 60 * 60 * 1000)
  return now.getTime() > graceDeadline.getTime()
}

export interface ChatLockParams {
  otherParticipantId: string | null | undefined
  otherParticipantDeletedAt?: string | null
  orderStatus?: string | null
  orderUpdatedAt?: string | null
  now?: Date
}

// Returns the reason sending is blocked, or null if the conversation is
// still open. Checked in this order because a deleted counterpart makes the
// order status irrelevant - there is no one left to receive the message.
export function getChatLockReason(params: ChatLockParams): ChatLockReason | null {
  const { otherParticipantId, otherParticipantDeletedAt, orderStatus, orderUpdatedAt, now } = params

  if (!otherParticipantId || otherParticipantDeletedAt) {
    return "deleted_counterpart"
  }

  if (isOrderChatLocked(orderStatus, orderUpdatedAt, now)) {
    return "order_closed"
  }

  return null
}
