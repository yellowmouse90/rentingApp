import { describe, it, expect } from "vitest"
import {
  formatPrice,
  calculateDays,
  calculateRentalPrice,
  calculateServiceFee,
  SERVICE_FEE_PERCENTAGE,
} from "./utils"

describe("formatPrice", () => {
  it("formats cents as EUR currency", () => {
    expect(formatPrice(1000)).toMatch(/^10,00\s€$/)
  })

  it("formats zero", () => {
    expect(formatPrice(0)).toMatch(/^0,00\s€$/)
  })
})

describe("calculateDays", () => {
  it("includes both start and end date", () => {
    const start = new Date("2026-01-01")
    const end = new Date("2026-01-01")
    expect(calculateDays(start, end)).toBe(1)
  })

  it("calculates a multi-day range", () => {
    const start = new Date("2026-01-01")
    const end = new Date("2026-01-05")
    expect(calculateDays(start, end)).toBe(5)
  })
})

describe("calculateRentalPrice", () => {
  it("uses daily rate when below a week", () => {
    expect(calculateRentalPrice(1000, 6000, 3)).toBe(3000)
  })

  it("uses weekly rate for full weeks plus daily rate for remainder", () => {
    expect(calculateRentalPrice(1000, 6000, 9)).toBe(6000 + 2 * 1000)
  })

  it("falls back to daily rate when no weekly rate is set", () => {
    expect(calculateRentalPrice(1000, null, 10)).toBe(10000)
  })
})

describe("calculateServiceFee", () => {
  it("applies the service fee percentage", () => {
    expect(calculateServiceFee(10000)).toBe(10000 * SERVICE_FEE_PERCENTAGE)
  })

  it("rounds to the nearest cent", () => {
    expect(calculateServiceFee(999)).toBe(Math.round(999 * SERVICE_FEE_PERCENTAGE))
  })
})
