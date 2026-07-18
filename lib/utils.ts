import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format cents to a currency string
 */
export function formatPrice(cents: number, currency: string = "EUR"): string {
  const amount = cents / 100
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: currency,
  }).format(amount)
}

/**
 * Get the translated condition label. Pass the `t` function from
 * useLanguage() (client) or getServerI18n() (server).
 */
export function getConditionLabel(condition: string, t: (key: string) => string): string {
  const keys: Record<string, string> = {
    new: "condition.new",
    like_new: "condition.like_new",
    good: "condition.good",
    fair: "condition.fair",
  }
  const key = keys[condition]
  return key ? t(key) : condition
}

/**
 * Get the translated rental status label. Pass the `t` function from
 * useLanguage() (client) or getServerI18n() (server).
 */
export function getRentalStatusLabel(status: string, t: (key: string) => string): string {
  const keys: Record<string, string> = {
    pending: "rental_status.pending",
    approved: "rental_status.approved",
    accepted: "rental_status.accepted",
    paid: "rental_status.paid",
    in_progress: "rental_status.in_progress",
    ongoing: "rental_status.ongoing",
    completed: "rental_status.completed",
    cancelled: "rental_status.cancelled",
    disputed: "rental_status.disputed",
    requested: "rental_status.requested",
    unavailable: "rental_status.unavailable",
    collected: "rental_status.collected",
    returned_ok: "rental_status.returned_ok",
    damaged: "rental_status.damaged",
  }
  const key = keys[status]
  return key ? t(key) : status
}

/**
 * Get rental status color class
 */
export function getRentalStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800",
    approved: "bg-emerald-100 text-emerald-800",
    accepted: "bg-emerald-100 text-emerald-800",
    paid: "bg-indigo-100 text-indigo-800",
    in_progress: "bg-blue-100 text-blue-800",
    ongoing: "bg-blue-100 text-blue-800",
    completed: "bg-slate-100 text-slate-800",
    cancelled: "bg-red-100 text-red-800",
    disputed: "bg-orange-100 text-orange-800",
    requested: "bg-amber-100 text-amber-800",
    unavailable: "bg-slate-100 text-slate-800",
    collected: "bg-cyan-100 text-cyan-800",
    returned_ok: "bg-emerald-100 text-emerald-800",
    damaged: "bg-red-100 text-red-800",
  }
  return colors[status] || "bg-slate-100 text-slate-800"
}

/**
 * Calculate number of days between two dates
 */
export function calculateDays(startDate: Date, endDate: Date): number {
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays + 1 // Include both start and end date
}

/**
 * Calculate rental price
 */
export function calculateRentalPrice(
  dailyRateCents: number,
  weeklyRateCents: number | null,
  days: number
): number {
  if (days >= 7 && weeklyRateCents) {
    const weeks = Math.floor(days / 7)
    const remainingDays = days % 7
    return weeks * weeklyRateCents + remainingDays * dailyRateCents
  }
  return days * dailyRateCents
}

/**
 * Platform service fee percentage (10%)
 */
export const SERVICE_FEE_PERCENTAGE = 0.1

/**
 * Calculate service fee
 */
export function calculateServiceFee(subtotalCents: number): number {
  return Math.round(subtotalCents * SERVICE_FEE_PERCENTAGE)
}

