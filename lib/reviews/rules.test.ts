import { describe, it, expect } from "vitest"
import {
  deriveReviewContext,
  getSubRatingKeys,
  isPubliclyReviewable,
  isWithinReviewWindow,
  validateReviewInput,
  REVIEW_WINDOW_DAYS,
} from "./rules"

describe("deriveReviewContext", () => {
  it("maps a business lender to the ferramenta context", () => {
    expect(deriveReviewContext("business")).toBe("ferramenta")
  })

  it("maps a private lender to the p2p context", () => {
    expect(deriveReviewContext("individual")).toBe("p2p")
  })
})

describe("isPubliclyReviewable", () => {
  it("ferramenta lender reviews are public", () => {
    expect(isPubliclyReviewable("ferramenta", "lender")).toBe(true)
  })

  it("ferramenta renter reviews stay internal-only", () => {
    expect(isPubliclyReviewable("ferramenta", "renter")).toBe(false)
  })

  it("p2p reviews are public in both directions", () => {
    expect(isPubliclyReviewable("p2p", "lender")).toBe(true)
    expect(isPubliclyReviewable("p2p", "renter")).toBe(true)
  })
})

describe("getSubRatingKeys", () => {
  it("returns the ferramenta-specific lender criteria", () => {
    expect(getSubRatingKeys("lender", "ferramenta")).toEqual([
      "item_match",
      "item_condition",
      "pickup_timeliness",
      "service",
    ])
  })

  it("returns the p2p-specific lender criteria including trust_overall", () => {
    expect(getSubRatingKeys("lender", "p2p")).toContain("trust_overall")
    expect(getSubRatingKeys("lender", "ferramenta")).not.toContain("trust_overall")
  })

  it("renter criteria are identical across contexts", () => {
    expect(getSubRatingKeys("renter", "ferramenta")).toEqual(getSubRatingKeys("renter", "p2p"))
  })
})

describe("isWithinReviewWindow", () => {
  const closedAt = new Date("2026-01-01T00:00:00Z")

  it("is true right after closure", () => {
    expect(isWithinReviewWindow(closedAt, new Date("2026-01-01T00:00:01Z"))).toBe(true)
  })

  it(`is true up to ${REVIEW_WINDOW_DAYS} days later`, () => {
    const justInside = new Date(closedAt.getTime() + REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000 - 1000)
    expect(isWithinReviewWindow(closedAt, justInside)).toBe(true)
  })

  it("is false once the window has elapsed", () => {
    const justOutside = new Date(closedAt.getTime() + REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000 + 1000)
    expect(isWithinReviewWindow(closedAt, justOutside)).toBe(false)
  })
})

describe("validateReviewInput", () => {
  it("accepts a minimal valid input (overall rating only)", () => {
    expect(validateReviewInput({ overall_rating: 5 })).toEqual([])
  })

  it("rejects an out-of-range overall rating", () => {
    expect(validateReviewInput({ overall_rating: 6 })).not.toEqual([])
    expect(validateReviewInput({ overall_rating: 0 })).not.toEqual([])
  })

  it("rejects a non-integer overall rating", () => {
    expect(validateReviewInput({ overall_rating: 4.5 })).not.toEqual([])
  })

  it("rejects an out-of-range sub_rating", () => {
    expect(validateReviewInput({ overall_rating: 5, sub_ratings: { service: 7 } })).not.toEqual([])
  })

  it("rejects too many tags", () => {
    const tags = Array.from({ length: 10 }, (_, i) => `tag-${i}`)
    expect(validateReviewInput({ overall_rating: 5, tags })).not.toEqual([])
  })

  it("rejects a comment over the max length", () => {
    expect(validateReviewInput({ overall_rating: 5, comment: "x".repeat(3000) })).not.toEqual([])
  })
})
