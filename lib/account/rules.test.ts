import { describe, it, expect } from "vitest"
import { FINAL_ORDER_STATUSES, isFinalOrderStatus, getBlockingOrderStatuses } from "./rules"

describe("isFinalOrderStatus", () => {
  it("treats completed, cancelled and disputed as terminal", () => {
    expect(isFinalOrderStatus("completed")).toBe(true)
    expect(isFinalOrderStatus("cancelled")).toBe(true)
    expect(isFinalOrderStatus("disputed")).toBe(true)
  })

  it("treats every in-flight status as non-terminal", () => {
    expect(isFinalOrderStatus("pending")).toBe(false)
    expect(isFinalOrderStatus("accepted")).toBe(false)
    expect(isFinalOrderStatus("paid")).toBe(false)
    expect(isFinalOrderStatus("in_progress")).toBe(false)
  })
})

describe("getBlockingOrderStatuses", () => {
  it("returns an empty list when every order is terminal", () => {
    expect(getBlockingOrderStatuses(["completed", "cancelled", "disputed"])).toEqual([])
  })

  it("returns an empty list for a user with no orders at all", () => {
    expect(getBlockingOrderStatuses([])).toEqual([])
  })

  it("surfaces every non-terminal order status", () => {
    expect(getBlockingOrderStatuses(["completed", "pending", "in_progress"])).toEqual([
      "pending",
      "in_progress",
    ])
  })

  it("agrees with FINAL_ORDER_STATUSES", () => {
    expect(getBlockingOrderStatuses([...FINAL_ORDER_STATUSES])).toEqual([])
  })
})
