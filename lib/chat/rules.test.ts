import { describe, it, expect } from "vitest"
import { isOrderChatLocked, getChatLockReason, CHAT_LOCK_GRACE_DAYS } from "./rules"

describe("isOrderChatLocked", () => {
  const closedAt = new Date("2026-01-01T00:00:00Z")

  it("is false for a non-terminal status regardless of age", () => {
    const longAfter = new Date(closedAt.getTime() + 30 * 24 * 60 * 60 * 1000)
    expect(isOrderChatLocked("in_progress", closedAt, longAfter)).toBe(false)
  })

  it("is false right after closure", () => {
    expect(isOrderChatLocked("completed", closedAt, new Date("2026-01-01T00:00:01Z"))).toBe(false)
  })

  it(`is false up to ${CHAT_LOCK_GRACE_DAYS} days later`, () => {
    const justInside = new Date(closedAt.getTime() + CHAT_LOCK_GRACE_DAYS * 24 * 60 * 60 * 1000 - 1000)
    expect(isOrderChatLocked("completed", closedAt, justInside)).toBe(false)
  })

  it("is true once the grace period has elapsed", () => {
    const justOutside = new Date(closedAt.getTime() + CHAT_LOCK_GRACE_DAYS * 24 * 60 * 60 * 1000 + 1000)
    expect(isOrderChatLocked("completed", closedAt, justOutside)).toBe(true)
  })

  it("treats cancelled and disputed the same as completed", () => {
    const justOutside = new Date(closedAt.getTime() + CHAT_LOCK_GRACE_DAYS * 24 * 60 * 60 * 1000 + 1000)
    expect(isOrderChatLocked("cancelled", closedAt, justOutside)).toBe(true)
    expect(isOrderChatLocked("disputed", closedAt, justOutside)).toBe(true)
  })

  it("is false when status or updatedAt is missing", () => {
    expect(isOrderChatLocked(null, closedAt)).toBe(false)
    expect(isOrderChatLocked("completed", null)).toBe(false)
  })
})

describe("getChatLockReason", () => {
  const closedAt = new Date("2026-01-01T00:00:00Z")
  const longAfter = new Date(closedAt.getTime() + 30 * 24 * 60 * 60 * 1000)

  it("returns null for an open conversation on an active order", () => {
    expect(
      getChatLockReason({
        otherParticipantId: "user-2",
        orderStatus: "in_progress",
        orderUpdatedAt: closedAt.toISOString(),
        now: longAfter,
      })
    ).toBeNull()
  })

  it("flags a missing counterpart id (hard-deleted, pre-migration-015)", () => {
    expect(getChatLockReason({ otherParticipantId: null })).toBe("deleted_counterpart")
  })

  it("flags a soft-deleted counterpart profile even though the id is present", () => {
    expect(
      getChatLockReason({
        otherParticipantId: "user-2",
        otherParticipantDeletedAt: "2026-01-05T00:00:00Z",
      })
    ).toBe("deleted_counterpart")
  })

  it("flags an order closed more than the grace period ago", () => {
    expect(
      getChatLockReason({
        otherParticipantId: "user-2",
        orderStatus: "completed",
        orderUpdatedAt: closedAt.toISOString(),
        now: longAfter,
      })
    ).toBe("order_closed")
  })

  it("prefers deleted_counterpart over order_closed when both apply", () => {
    expect(
      getChatLockReason({
        otherParticipantId: null,
        orderStatus: "completed",
        orderUpdatedAt: closedAt.toISOString(),
        now: longAfter,
      })
    ).toBe("deleted_counterpart")
  })

  it("does not lock a just-closed order still inside the grace period", () => {
    expect(
      getChatLockReason({
        otherParticipantId: "user-2",
        orderStatus: "completed",
        orderUpdatedAt: closedAt.toISOString(),
        now: new Date("2026-01-01T12:00:00Z"),
      })
    ).toBeNull()
  })
})
